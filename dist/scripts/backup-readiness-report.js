#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(agentDir, "session-store");
const graphDir = join(agentDir, "session-graph");
const sqlitePath = join(storeDir, "session-store.sqlite");
function count(db, sql) { return db.prepare(sql).get().c; }
function all(db, sql) { return db.prepare(sql).all(); }
const db = new DatabaseSync(sqlitePath, { readOnly: true });
try {
    const backupSources = count(db, "SELECT COUNT(*) c FROM sources WHERE provider = 'backup-snapshot' OR uri LIKE '%/session-backups/%'");
    const backupObservations = count(db, "SELECT COUNT(*) c FROM backup_observations");
    const backupSessionObservations = count(db, "SELECT COUNT(*) c FROM session_observations WHERE path LIKE '%/session-backups/%'");
    const backupLabels = count(db, "SELECT COUNT(*) c FROM labels WHERE metadata_json LIKE '%backup-%' OR source_id IN (SELECT id FROM sources WHERE provider = 'backup-snapshot' OR uri LIKE '%/session-backups/%')");
    const backupEvidence = count(db, "SELECT COUNT(*) c FROM evidence WHERE kind = 'backup_presence' OR data_json LIKE '%session-backups%'");
    const backupPaths = all(db, "SELECT path FROM session_observations WHERE path LIKE '%/session-backups/%' ORDER BY path").map((row) => row.path);
    const evidence = all(db, "SELECT id, summary, data_json FROM evidence WHERE kind = 'backup_presence' OR data_json LIKE '%session-backups%' ORDER BY id");
    const remainingRawDependencies = all(db, "SELECT path FROM artifacts WHERE path LIKE '%/session-backups/%' UNION SELECT uri AS path FROM sources WHERE uri LIKE '%/session-backups/%' ORDER BY path").map((row) => row.path);
    const ready = backupSources > 0 && backupSessionObservations > 0 && backupEvidence > 0;
    const generatedAt = new Date().toISOString();
    const report = [
        "# Backup deletion readiness report",
        "",
        `Generated: ${generatedAt}`,
        `SQLite store: ${sqlitePath}`,
        "",
        ready ? "Status: backup facts have been extracted into the canonical store. Do not delete backups solely on this report until you have manually reviewed the listed raw-path dependencies." : "Status: NOT READY. Backup facts are missing or incomplete in the canonical store.",
        "",
        "## Counts",
        `- backup sources: ${backupSources}`,
        `- backup session observations: ${backupSessionObservations}`,
        `- backup presence/absence observations: ${backupObservations}`,
        `- backup-derived labels: ${backupLabels}`,
        `- backup evidence records: ${backupEvidence}`,
        "",
        "## Backup session paths preserved as observations",
        ...backupPaths.map((path) => `- ${path}`),
        "",
        "## Backup evidence records",
        ...evidence.map((row) => `- ${row.id}: ${row.summary}`),
        "",
        "## Remaining raw backup path references",
        ...(remainingRawDependencies.length ? remainingRawDependencies.map((path) => `- ${path}`) : ["- none in artifacts/sources"]),
        "",
        "## Policy",
        "- This report does not delete backup folders.",
        "- Keep raw backup archives elsewhere if possible.",
        "- Local extracted backup folders can be removed only after reviewing this report and confirming the canonical store/export preserve the facts you need.",
        "",
    ].join("\n");
    await mkdir(storeDir, { recursive: true });
    await mkdir(graphDir, { recursive: true });
    await writeFile(join(storeDir, "backup-readiness.md"), report);
    await writeFile(join(graphDir, "backup-readiness.md"), report);
    console.log(`Wrote ${join(storeDir, "backup-readiness.md")}`);
}
finally {
    db.close();
}
//# sourceMappingURL=backup-readiness-report.js.map