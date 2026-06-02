#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
const home = process.env.HOME ?? ".";
const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(home, ".pi", "agent", "session-store");
const sidecar = join(storeDir, "repo-identities.jsonl");
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
function githubFromRow(row) {
    const gh = row.metadata?.github;
    if (gh?.owner && gh?.name)
        return { owner: String(gh.owner), name: String(gh.name) };
    const raw = row.remoteUrl ?? row.metadata?.remoteUrl;
    if (typeof raw !== "string")
        return undefined;
    const normalized = raw.trim().replace(/\.git$/i, "");
    const m = normalized.match(/^git@github\.com:([^/]+)\/(.+)$/i) ?? normalized.match(/^https?:\/\/github\.com\/([^/]+)\/(.+)$/i);
    return m ? { owner: m[1], name: m[2] } : undefined;
}
async function readRows() { try {
    return (await readFile(sidecar, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
catch {
    return [];
} }
if (!token) {
    console.log("No GITHUB_TOKEN/GH_TOKEN set; skipping optional GitHub enrichment.");
    process.exit(0);
}
const rows = await readRows();
const existing = new Set(rows.map((r) => JSON.stringify(r)));
const additions = [];
for (const row of rows) {
    if (row.kind !== "repo-observation")
        continue;
    const gh = githubFromRow(row);
    if (!gh || !row.stableName)
        continue;
    const res = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.name}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "agent-session-store" } });
    if (!res.ok)
        continue;
    const data = await res.json();
    const enriched = { kind: "repo-observation", stableName: row.stableName, remoteUrl: data.html_url, validFrom: new Date().toISOString(), confidence: "github-api", metadata: { source: "github-api", github: { id: data.id, nodeId: data.node_id, fullName: data.full_name, htmlUrl: data.html_url, createdAt: data.created_at, pushedAt: data.pushed_at, archived: data.archived, fork: data.fork, parentFullName: data.parent?.full_name, sourceFullName: data.source?.full_name } } };
    const key = JSON.stringify(enriched);
    if (!existing.has(key)) {
        existing.add(key);
        additions.push(enriched);
    }
}
await mkdir(storeDir, { recursive: true });
if (additions.length)
    await writeFile(sidecar, additions.map((r) => JSON.stringify(r)).join("\n") + "\n", { flag: "a" });
console.log(`Wrote ${additions.length} GitHub API enrichment records to ${sidecar}`);
//# sourceMappingURL=enrich-github-repos.js.map