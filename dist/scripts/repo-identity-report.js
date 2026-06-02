#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(agentDir, "session-store");
const graphDir = join(agentDir, "session-graph");
const dbPath = join(storeDir, "session-store.sqlite");
function parseJson(value, fallback) { if (typeof value !== "string")
    return fallback; try {
    return JSON.parse(value);
}
catch {
    return fallback;
} }
const db = new DatabaseSync(dbPath, { readOnly: true });
try {
    const identities = db.prepare("SELECT id, stable_name, display_name, description, confidence, source FROM repo_identities ORDER BY stable_name").all();
    const observations = db.prepare("SELECT repo_identity_id, path, bucket, remote_url, valid_from, valid_to, confidence, source, metadata_json FROM repo_observations ORDER BY repo_identity_id, valid_from, path").all();
    const events = db.prepare("SELECT event_type, repo_identity_id, related_repo_identity_id, from_path, to_path, timestamp, confidence, source, manual_review_required, summary, metadata_json FROM repo_events ORDER BY timestamp, event_type").all();
    const lines = ["# Repo identity report", "", `Generated: ${new Date().toISOString()}`, "", `Identities: ${identities.length}`, `Observations: ${observations.length}`, `Events: ${events.length}`, ""];
    for (const identity of identities) {
        lines.push(`## ${identity.display_name ?? identity.stable_name}`, "", `- id: ${identity.id}`, `- stable name: ${identity.stable_name}`, `- confidence: ${identity.confidence}`, ...(identity.description ? [`- description: ${identity.description}`] : []), "", "### Observations");
        const obs = observations.filter((row) => row.repo_identity_id === identity.id);
        if (!obs.length)
            lines.push("- none");
        for (const row of obs)
            lines.push(`- ${row.path ?? row.bucket ?? row.remote_url ?? "(unknown)"}${row.valid_from || row.valid_to ? ` (${row.valid_from ?? "?"} → ${row.valid_to ?? "?"})` : ""} [${row.confidence}]`);
        const evs = events.filter((row) => row.repo_identity_id === identity.id || row.related_repo_identity_id === identity.id);
        lines.push("", "### Events");
        if (!evs.length)
            lines.push("- none");
        for (const row of evs)
            lines.push(`- ${row.timestamp ?? "unknown"} ${row.event_type}: ${row.summary ?? `${row.from_path ?? ""} -> ${row.to_path ?? ""}`.trim()} [${row.confidence}${row.manual_review_required ? ", review" : ""}]`);
        lines.push("");
    }
    if (!identities.length)
        lines.push("No repo identities imported yet. Add records to `~/.pi/agent/session-store/repo-identities.jsonl` and run `npm run build-store`.", "");
    const out = lines.join("\n");
    await mkdir(storeDir, { recursive: true });
    await mkdir(graphDir, { recursive: true });
    await writeFile(join(storeDir, "repo-identities.md"), out);
    await writeFile(join(graphDir, "repo-identities.md"), out);
    console.log(`Wrote ${join(storeDir, "repo-identities.md")}`);
}
finally {
    db.close();
}
//# sourceMappingURL=repo-identity-report.js.map