#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(agentDir, "session-store");
const exportPath = join(storeDir, "session-store.export.json");
function str(value) { return typeof value === "string" && value.trim() ? value : undefined; }
function minTs(a, b) { if (!a)
    return b; if (!b)
    return a; return a.localeCompare(b) <= 0 ? a : b; }
function maxTs(a, b) { if (!a)
    return b; if (!b)
    return a; return a.localeCompare(b) >= 0 ? a : b; }
function normalizeRepoPath(path) {
    return path
        .replace(/^\/users\/sam\//, "/Users/sam/")
        .replace(/^\/Users\/sam\/(?:Users|users)\/sam\//, "/Users/sam/")
        .replace(/^\/Users\/sam\/users-sam-git-agents-/, "/Users/sam/git/agents/")
        .replace(/^users-sam-git-agents-/, "/Users/sam/git/agents/")
        .replace(/^\/Users\/sam\/users-sam-git-/, "/Users/sam/git/")
        .replace(/^users-sam-git-/, "/Users/sam/git/")
        .replace(/^users-sam-/, "/Users/sam/");
}
function normalizeName(path) {
    const base = basename(path).toLowerCase().replace(/\.git$/, "");
    return base.replace(/v\d+$/i, "").replace(/[-_\s]+/g, "").replace(/[^a-z0-9]/g, "");
}
function displayName(path) { return basename(path).replace(/[-_]+/g, " ").replace(/\bv(\d+)$/i, "v$1").replace(/\b\w/g, (c) => c.toUpperCase()); }
function stableName(path) { return basename(path).toLowerCase().replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[_\s]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-"); }
function acronymBase(name) { return name.replace(/v\d+$/i, "").split(/[-_\s]+/).filter(Boolean).map((part) => part[0]).join("").toLowerCase(); }
function compactWithoutVersion(name) { return name.toLowerCase().replace(/v\d+$/i, "").replace(/[^a-z0-9]/g, ""); }
async function gitRemote(path) {
    if (!existsSync(path))
        return undefined;
    try {
        return (await execFileAsync("git", ["remote", "get-url", "origin"], { cwd: path })).stdout.trim() || undefined;
    }
    catch {
        return undefined;
    }
}
function nameSimilarity(a, b) {
    const aa = new Set(a.split("")), bb = new Set(b.split(""));
    const inter = [...aa].filter((ch) => bb.has(ch)).length;
    const union = new Set([...aa, ...bb]).size || 1;
    return inter / union;
}
function withinDays(a, b, days = 14) {
    if (!a || !b)
        return false;
    const gap = Math.abs(Date.parse(a) - Date.parse(b));
    return Number.isFinite(gap) && gap <= days * 86400000;
}
const store = JSON.parse(await readFile(exportPath, "utf8"));
const byPath = new Map();
for (const session of store.sessions ?? []) {
    const cwd = str(session.metadata?.cwd);
    if (!cwd || cwd.startsWith("("))
        continue;
    const path = normalizeRepoPath(cwd);
    const item = byPath.get(path) ?? { path, normalizedName: normalizeName(path), parent: dirname(path), sessions: 0, providers: [], existingIdentityIds: [] };
    item.sessions++;
    item.first = minTs(item.first, session.startTimestamp ?? session.firstSeenAt);
    item.last = maxTs(item.last, session.endTimestamp ?? session.lastSeenAt);
    if (!item.providers.includes(session.provider))
        item.providers.push(session.provider);
    byPath.set(path, item);
}
for (const obs of store.repoObservations ?? []) {
    if (!obs.path)
        continue;
    const path = normalizeRepoPath(obs.path);
    const item = byPath.get(path) ?? { path, normalizedName: normalizeName(path), parent: dirname(path), sessions: 0, providers: [], existingIdentityIds: [] };
    if (obs.remoteUrl)
        item.remote = obs.remoteUrl;
    if (!item.existingIdentityIds.includes(obs.repoIdentityId))
        item.existingIdentityIds.push(obs.repoIdentityId);
    byPath.set(path, item);
}
await Promise.all([...byPath.values()].map(async (item) => { item.remote ??= await gitRemote(item.path); }));
const paths = [...byPath.values()].filter((p) => p.sessions > 0);
const candidates = [];
const seenGroups = new Set();
for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
        const a = paths[i], b = paths[j];
        const evidence = [];
        if (a.remote && b.remote && a.remote === b.remote)
            evidence.push(`same git remote: ${a.remote}`);
        if (a.parent === b.parent)
            evidence.push(`same parent directory: ${a.parent}`);
        else if (basename(a.parent).toLowerCase() === basename(b.parent).toLowerCase())
            evidence.push(`same parent project folder name: ${basename(a.parent)}`);
        if (a.normalizedName === b.normalizedName)
            evidence.push(`same normalized basename: ${a.normalizedName}`);
        else if (a.normalizedName.includes(b.normalizedName) || b.normalizedName.includes(a.normalizedName))
            evidence.push(`basename containment: ${basename(a.path)} ↔ ${basename(b.path)}`);
        else if (nameSimilarity(a.normalizedName, b.normalizedName) >= 0.72)
            evidence.push(`similar basenames: ${basename(a.path)} ↔ ${basename(b.path)}`);
        const aAcronym = acronymBase(basename(a.path));
        const bAcronym = acronymBase(basename(b.path));
        const aCompact = compactWithoutVersion(basename(a.path));
        const bCompact = compactWithoutVersion(basename(b.path));
        if ((aAcronym && aAcronym === bCompact) || (bAcronym && bAcronym === aCompact))
            evidence.push(`acronym/name match: ${basename(a.path)} ↔ ${basename(b.path)}`);
        if (withinDays(a.last, b.first, 45) || withinDays(b.last, a.first, 45))
            evidence.push("temporal continuity within 45 days");
        const strong = evidence.some((e) => e.startsWith("same git remote"));
        const medium = evidence.length >= 3 || (evidence.some((e) => e.startsWith("same parent")) && evidence.some((e) => /basename|acronym/.test(e)));
        if (!strong && !medium)
            continue;
        const groupPaths = [a.path, b.path].sort();
        const key = groupPaths.join("\0");
        if (seenGroups.has(key))
            continue;
        seenGroups.add(key);
        const primary = groupPaths.sort((x, y) => basename(y).length - basename(x).length)[0];
        candidates.push({
            id: `repo_candidate_${candidates.length + 1}`,
            suggestedStableName: stableName(primary),
            displayName: displayName(primary),
            paths: groupPaths,
            confidence: strong ? "high" : medium ? "medium" : "low",
            manualApprovalRequired: !strong,
            evidence,
            metrics: { sessions: a.sessions + b.sessions, providers: [...new Set([...a.providers, ...b.providers])].sort(), first: minTs(a.first, b.first), last: maxTs(a.last, b.last) },
        });
    }
}
const out = { generatedAt: new Date().toISOString(), source: exportPath, candidates: candidates.sort((a, b) => (b.confidence.localeCompare(a.confidence)) || b.metrics.sessions - a.metrics.sessions) };
await mkdir(storeDir, { recursive: true });
await writeFile(join(storeDir, "repo-identity-candidates.json"), JSON.stringify(out, null, 2) + "\n");
const md = [`# Repo identity candidates`, ``, `Generated: ${out.generatedAt}`, ``, `Candidates: ${out.candidates.length}`, ``];
for (const c of out.candidates)
    md.push(`## ${c.displayName}`, ``, `Stable name: \`${c.suggestedStableName}\``, `Confidence: ${c.confidence}`, `Manual approval required: ${c.manualApprovalRequired}`, `Sessions: ${c.metrics.sessions}`, `Providers: ${c.metrics.providers.join(", ")}`, `First/last: ${c.metrics.first ?? "?"} → ${c.metrics.last ?? "?"}`, ``, `Paths:`, ...c.paths.map((p) => `- \`${p}\``), ``, `Evidence:`, ...c.evidence.map((e) => `- ${e}`), ``);
await writeFile(join(storeDir, "repo-identity-candidates.md"), md.join("\n"));
console.log(`Wrote ${join(storeDir, "repo-identity-candidates.json")}`);
console.log(`Wrote ${join(storeDir, "repo-identity-candidates.md")}`);
//# sourceMappingURL=repo-identity-candidates.js.map