#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(process.env.HOME ?? ".", ".pi", "agent");
const sessionsDir = join(agentDir, "sessions");
const outDir = join(agentDir, "session-graph");
async function walk(dir) {
    const out = [];
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    }
    catch {
        return out;
    }
    for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory())
            out.push(...await walk(path));
        else if (entry.isFile() && entry.name.endsWith(".jsonl"))
            out.push(path);
    }
    return out;
}
function hash(text) {
    return createHash("sha256").update(text).digest("hex");
}
async function inspectSession(path) {
    const raw = await readFile(path, "utf8").catch(() => "");
    const lines = raw.split("\n").filter(Boolean);
    const st = await stat(path);
    return {
        path,
        size: st.size,
        lines: lines.length,
        firstLineHash: lines[0] ? hash(lines[0]) : undefined,
        first16Hash: lines.length ? hash(lines.slice(0, 16).join("\n")) : undefined,
    };
}
function extractDestinations(raw) {
    const matches = raw.match(/\/[^\s'"`]+\.jsonl/g) ?? [];
    return [...new Set(matches.filter((m) => m.includes("/.pi/agent/sessions/") && m.includes("_relocated_")))];
}
function parseEntryTimestamp(line) {
    try {
        const parsed = JSON.parse(line);
        const value = parsed.timestamp ?? parsed.message?.timestamp;
        if (typeof value === "number" && Number.isFinite(value))
            return new Date(value).toISOString();
        if (typeof parsed.ts === "string")
            return parsed.ts;
    }
    catch {
        // Session lines can contain arbitrary extension data; fail closed.
    }
    return undefined;
}
function parseRelocatedTimestamp(path) {
    const matches = [...path.matchAll(/_relocated_(?:.*?_)?(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/g)];
    const stamp = matches.at(-1)?.[1];
    if (!stamp)
        return undefined;
    return stamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z");
}
function timeDeltaMs(a, b) {
    if (!a || !b)
        return undefined;
    const left = Date.parse(a);
    const right = Date.parse(b);
    if (!Number.isFinite(left) || !Number.isFinite(right))
        return undefined;
    return Math.abs(left - right);
}
function confidenceLevel(score) {
    if (score >= 120)
        return "high";
    if (score >= 80)
        return "medium";
    return "low";
}
async function main() {
    const sessionFiles = await walk(sessionsDir);
    const sessions = [];
    const mtimes = new Map();
    const candidates = [];
    for (const path of sessionFiles) {
        const raw = await readFile(path, "utf8").catch(() => "");
        const info = await inspectSession(path);
        sessions.push(info);
        const sourceMtimeMs = (await stat(path)).mtimeMs;
        mtimes.set(path, sourceMtimeMs);
        const lines = raw.split("\n");
        for (let i = 0; i < lines.length; i++) {
            if (!lines[i]?.includes("Relocated session written") && !lines[i]?.includes("pi --session"))
                continue;
            const window = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");
            for (const dest of extractDestinations(window)) {
                const destinationMtimeMs = mtimes.get(dest) ?? (await stat(dest).then((s) => s.mtimeMs).catch(() => undefined));
                const distanceFromEnd = lines.length - (i + 1);
                const entryTs = parseEntryTimestamp(lines[i] ?? "");
                const destinationTs = parseRelocatedTimestamp(dest);
                const delta = timeDeltaMs(entryTs, destinationTs);
                const reason = [];
                let score = 0;
                let rejected;
                if (dest === path)
                    rejected = "self-edge";
                else if (!destinationMtimeMs)
                    rejected = "destination-missing";
                else {
                    score += 40;
                    reason.push("relocate output/path found");
                    if (distanceFromEnd <= 20) {
                        score += 50;
                        reason.push("near end of session");
                    }
                    else if (distanceFromEnd <= 100) {
                        score += 25;
                        reason.push("within last 100 lines");
                    }
                    else {
                        const penalty = Math.min(45, Math.floor(distanceFromEnd / 100));
                        score -= penalty;
                        reason.push(`far from end (-${penalty})`);
                    }
                    if (delta !== undefined && delta <= 5 * 60 * 1000) {
                        score += 70;
                        reason.push("entry timestamp matches destination timestamp");
                    }
                    else if (delta !== undefined && delta <= 60 * 60 * 1000) {
                        score += 25;
                        reason.push("entry timestamp near destination timestamp");
                    }
                    else if (delta !== undefined) {
                        score -= 25;
                        reason.push("entry timestamp far from destination timestamp");
                    }
                    if (sourceMtimeMs > destinationMtimeMs + 1000) {
                        score -= 20;
                        reason.push("source mtime newer than destination");
                    }
                    if (dest.includes(basename(path).replace(/\.jsonl$/, ""))) {
                        score += 10;
                        reason.push("destination name contains source basename");
                    }
                }
                candidates.push({
                    sourceSession: path,
                    destinationSession: dest,
                    evidenceSession: path,
                    evidenceLine: i + 1,
                    entryTs,
                    destinationTs,
                    confidence: "relocate-output",
                    sourceMtimeMs,
                    destinationMtimeMs,
                    distanceFromEnd,
                    score,
                    rejected: rejected ?? (score < 80 ? "low-score-or-copied-output-likely" : undefined),
                    reason,
                });
            }
        }
    }
    const grouped = new Map();
    for (const candidate of candidates) {
        const list = grouped.get(candidate.destinationSession) ?? [];
        list.push(candidate);
        grouped.set(candidate.destinationSession, list);
    }
    const bestByDestination = new Map();
    const rejected = candidates.filter((edge) => edge.rejected);
    const alternatives = {};
    for (const [destination, group] of grouped.entries()) {
        const viable = group.filter((edge) => !edge.rejected).sort((a, b) => b.score - a.score || a.sourceMtimeMs - b.sourceMtimeMs);
        alternatives[destination] = group.sort((a, b) => b.score - a.score).slice(0, 5);
        const best = viable[0];
        if (best)
            bestByDestination.set(destination, { ...best, confidenceLevel: confidenceLevel(best.score) });
    }
    const edges = [...bestByDestination.values()].sort((a, b) => (a.destinationMtimeMs ?? 0) - (b.destinationMtimeMs ?? 0));
    await mkdir(outDir, { recursive: true });
    const graph = { generatedAt: new Date().toISOString(), sessions, edges, candidates, rejected, alternatives };
    await writeFile(join(outDir, "reconstruction.json"), JSON.stringify(graph, null, 2));
    const report = [
        "# Session graph reconstruction",
        "",
        `Generated: ${graph.generatedAt}`,
        `Sessions scanned: ${sessions.length}`,
        `Candidate edges found from relocate outputs: ${candidates.length}`,
        `Accepted best edges by destination: ${edges.length}`,
        `Rejected candidates: ${rejected.length}`,
        "",
        "## Edges",
        ...edges.map((e) => `- ${e.sourceSession} -> ${e.destinationSession} (${e.confidenceLevel}, score=${e.score}, ${e.evidenceSession}:${e.evidenceLine}; ${e.reason.join("; ")})`),
        "",
        "## Rejected candidate summary",
        ...Object.entries(rejected.reduce((acc, edge) => {
            acc[edge.rejected ?? "unknown"] = (acc[edge.rejected ?? "unknown"] ?? 0) + 1;
            return acc;
        }, {})).map(([reason, count]) => `- ${reason}: ${count}`),
        "",
    ].join("\n");
    await writeFile(join(outDir, "reconstruction.md"), report);
    console.log(`Wrote ${join(outDir, "reconstruction.json")}`);
    console.log(`Wrote ${join(outDir, "reconstruction.md")}`);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=reconstruct-local-history.js.map