#!/usr/bin/env node
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const sessionsDir = join(agentDir, "sessions");
const codingSessionsDir = join(home, "Downloads", "coding-sessions");
const sessionBackupsDir = join(home, "Downloads", "session-backups");
const gitRoot = join(home, "git");
const outDir = join(agentDir, "session-store");
const graphDir = join(agentDir, "session-graph");
const manifestPath = join(agentDir, "relocations.jsonl");
const overlaysPath = join(graphDir, "lineage-overlays.jsonl");
async function exists(path) { try {
    await stat(path);
    return true;
}
catch {
    return false;
} }
async function readJsonl(path) { const raw = await readFile(path, "utf8").catch(() => ""); return raw.split("\n").filter((l) => l.trim()).flatMap((l) => { try {
    return [JSON.parse(l)];
}
catch {
    return [];
} }); }
function decodeBucket(bucket) {
    if (!bucket.startsWith("--") || !bucket.endsWith("--"))
        return undefined;
    const inner = bucket.slice(2, -2);
    if (!inner)
        return "/";
    if (inner.startsWith("Users-sam-"))
        return `/Users/sam/${inner.slice("Users-sam-".length).replaceAll("-", "/")}`;
    return `/${inner.replaceAll("-", "/")}`;
}
function tsFromFile(file) { return file.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/)?.[1]?.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z"); }
function rowCwd(row) { if (typeof row.cwd === "string")
    return row.cwd; const session = row.session; return typeof session?.cwd === "string" ? session.cwd : undefined; }
async function cwdsFromSession(path) {
    const raw = await readFile(path, "utf8").catch(() => "");
    const found = new Set();
    for (const line of raw.split("\n")) {
        if (!line.trim())
            continue;
        try {
            const cwd = rowCwd(JSON.parse(line));
            if (cwd)
                found.add(cwd);
        }
        catch { /* ignore */ }
    }
    return [...found].sort((a, b) => b.length - a.length);
}
async function findSessionRoots(root) {
    const roots = [];
    async function walk(dir, depth) {
        if (depth > 12)
            return;
        const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
        if (entries.some((e) => e.isDirectory() && e.name.startsWith("--") && e.name.endsWith("--")))
            roots.push(dir);
        for (const entry of entries)
            if (entry.isDirectory() && !["node_modules", ".git", ".jj"].includes(entry.name))
                await walk(join(dir, entry.name), depth + 1);
    }
    if (await exists(root))
        await walk(root, 0);
    return [...new Set(roots)].sort();
}
async function findGitRepos(root) {
    const out = [];
    async function walk(dir, depth) {
        if (depth > 8)
            return;
        const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
        if (entries.some((entry) => entry.isDirectory() && entry.name === ".git")) {
            out.push(dir);
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || ["node_modules", ".git", ".jj", "target", "dist", "Library"].includes(entry.name))
                continue;
            await walk(join(dir, entry.name), depth + 1);
        }
    }
    if (await exists(root))
        await walk(root, 0);
    return [...new Set(out)].sort();
}
function compactName(value) { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function sameRepoCandidates(name, cwdCandidates, decodedPath, gitRepos) {
    const names = new Set([name, ...cwdCandidates.map((cwd) => basename(cwd)), decodedPath ? basename(decodedPath) : undefined].filter((v) => Boolean(v && v !== "/")));
    const compactNames = new Set([...names].map(compactName));
    return gitRepos.filter((repo) => names.has(basename(repo)) || compactNames.has(compactName(basename(repo)))).slice(0, 25);
}
function classify(root, decodedPath, decodedExists, cwdCandidates, cwdExists, sameBasenameCandidates) {
    const reasons = [];
    if (root !== sessionsDir)
        return { status: "external-import", confidence: "high", reasons: ["session root is outside live Pi sessions"] };
    if (decodedPath && decodedExists)
        return { status: "active-exact", confidence: "medium", reasons: ["decoded bucket path exists", "bucket decoding is lossy"] };
    const existingCwd = cwdCandidates.find((cwd) => cwdExists[cwd]);
    if (existingCwd)
        return { status: "active-via-cwd", confidence: "high", reasons: [`session row cwd exists: ${existingCwd}`] };
    if (sameBasenameCandidates.length)
        return { status: "moved-or-renamed-candidate", confidence: "low", reasons: [`same basename exists elsewhere: ${sameBasenameCandidates.slice(0, 3).join(", ")}`, "requires manual review"] };
    if (decodedPath && decodedPath.includes("/"))
        reasons.push("decoded path does not exist");
    if (!cwdCandidates.length)
        reasons.push("no cwd metadata found in sampled session rows");
    return { status: decodedPath ? "missing-unclassified" : "decode-ambiguous", confidence: "low", reasons };
}
async function scanRoot(root, manifest, overlays, gitRepos) {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    const buckets = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith("--") || !entry.name.endsWith("--"))
            continue;
        const dir = join(root, entry.name);
        const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".jsonl")).sort();
        const fullFiles = files.map((f) => join(dir, f));
        const times = files.map(tsFromFile).filter((v) => Boolean(v)).sort();
        const decodedPath = decodeBucket(entry.name);
        const decodedExists = decodedPath ? await exists(decodedPath) : undefined;
        const cwdSet = new Set();
        for (const file of fullFiles.slice(-5))
            for (const cwd of await cwdsFromSession(file))
                cwdSet.add(cwd);
        const cwdCandidates = [...cwdSet].sort((a, b) => b.length - a.length);
        const cwdExists = Object.fromEntries(await Promise.all(cwdCandidates.map(async (cwd) => [cwd, await exists(cwd)])));
        const manifestCwds = [...new Set(manifest.flatMap((m) => fullFiles.includes(m.sourceSession ?? "") ? [m.fromCwd].filter(Boolean) : fullFiles.includes(m.destinationSession ?? "") ? [m.toCwd].filter(Boolean) : []))];
        const overlayLabels = [...new Set(overlays.flatMap((o) => o.session && fullFiles.includes(o.session) ? [o.cwd, o.label].filter(Boolean) : o.path === decodedPath ? [o.label].filter(Boolean) : []))];
        const sameBasenameCandidates = sameRepoCandidates(basename(cwdCandidates[0] ?? decodedPath ?? ""), cwdCandidates, decodedPath, gitRepos);
        const { status, confidence, reasons } = classify(root, decodedPath, decodedExists, cwdCandidates, cwdExists, sameBasenameCandidates);
        buckets.push({ root, bucket: entry.name, decodedPath, decodedExists, cwdCandidates, cwdExists, manifestCwds, overlayLabels, sameBasenameCandidates, status, confidence, reasons, sessionCount: files.length, earliest: times[0], latest: times.at(-1), files: fullFiles });
    }
    return buckets.sort((a, b) => (b.sessionCount - a.sessionCount) || a.bucket.localeCompare(b.bucket));
}
const manifest = await readJsonl(manifestPath);
const overlays = await readJsonl(overlaysPath);
const roots = [sessionsDir, ...(await findSessionRoots(codingSessionsDir)), ...(await findSessionRoots(sessionBackupsDir))].filter((v, i, a) => a.indexOf(v) === i);
const gitRepos = await findGitRepos(gitRoot);
const buckets = (await Promise.all(roots.map((root) => scanRoot(root, manifest, overlays, gitRepos)))).flat();
const byStatus = buckets.reduce((acc, bucket) => { acc[bucket.status] = (acc[bucket.status] ?? 0) + 1; return acc; }, {});
const payload = { generatedAt: new Date().toISOString(), roots, gitRoot, gitRepoCount: gitRepos.length, bucketCount: buckets.length, byStatus, buckets };
await mkdir(outDir, { recursive: true });
await mkdir(graphDir, { recursive: true });
await writeFile(join(outDir, "session-bucket-inventory.json"), JSON.stringify(payload, null, 2) + "\n");
await writeFile(join(outDir, "session-bucket-reconciliation.json"), JSON.stringify(payload, null, 2) + "\n");
const report = [
    "# Session bucket reconciliation",
    "",
    `Generated: ${payload.generatedAt}`,
    "",
    "## Roots",
    ...roots.map((r) => `- ${r}`),
    "",
    `Git repos scanned under ${gitRoot}: ${gitRepos.length}`,
    "",
    "## Status counts",
    ...Object.entries(byStatus).sort().map(([status, count]) => `- ${status}: ${count}`),
    "",
    "## Moved/renamed candidates",
    ...buckets.filter((b) => b.status === "moved-or-renamed-candidate").slice(0, 100).map((b) => `- ${b.decodedPath ?? b.bucket} (${b.sessionCount} sessions, ${b.earliest ?? "?"} → ${b.latest ?? "?"}) candidates=${b.sameBasenameCandidates.slice(0, 5).join(", ")}`),
    "",
    "## Missing unclassified",
    ...buckets.filter((b) => b.status === "missing-unclassified").slice(0, 150).map((b) => `- ${b.decodedPath ?? b.bucket} (${b.sessionCount} sessions, ${b.earliest ?? "?"} → ${b.latest ?? "?"}; reasons=${b.reasons.join("; ")})`),
    "",
    "## External imports",
    ...buckets.filter((b) => b.status === "external-import").map((b) => `- ${b.root} :: ${b.decodedPath ?? b.bucket} (${b.sessionCount} sessions)`),
    "",
    "## Largest buckets",
    ...buckets.slice(0, 100).map((b) => `- [${b.status}/${b.confidence}] ${b.cwdCandidates[0] ?? b.decodedPath ?? b.bucket}: ${b.sessionCount} sessions, decodedExists=${b.decodedExists}, ${b.earliest ?? "?"} → ${b.latest ?? "?"}`),
    "",
    "Note: missing paths are not declared deleted/deprecated by this report. Bucket decoding is lossy for hyphens vs path separators; use cwd metadata, aliases, manifests, and manual review for stronger classification.",
    "",
].join("\n");
await writeFile(join(outDir, "session-bucket-inventory.md"), report);
await writeFile(join(outDir, "session-bucket-reconciliation.md"), report);
await writeFile(join(graphDir, "session-bucket-inventory.md"), report);
await writeFile(join(graphDir, "session-bucket-reconciliation.md"), report);
console.log(`Wrote ${join(outDir, "session-bucket-reconciliation.md")}`);
console.log(`Discovered ${buckets.length} buckets across ${roots.length} roots: ${JSON.stringify(byStatus)}`);
//# sourceMappingURL=inventory-session-buckets.js.map