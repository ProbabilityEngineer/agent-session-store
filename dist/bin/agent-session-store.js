#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const root = basename(here) === "bin" && basename(dirname(here)) === "dist" ? join(here, "..", "..") : join(here, "..");
const command = process.argv[2] ?? "help";
const rest = process.argv.slice(3);
const version = JSON.parse(await readFile(join(root, "package.json"), "utf8")).version;
const artifactPaths = [
    "session-store.sqlite",
    "session-store.export.json",
    "graph-export.json",
    "repo-identities.md",
];
const scripts = {
    build: ["scripts/build-curated-store.js"],
    "build-store": ["scripts/build-curated-store.js"],
    "export-graph": ["scripts/export-graph-json.js"],
    "scan-repos": ["scripts/scan-repo-identities.js"],
    "repo-identities": ["scripts/repo-identity-report.js"],
    "repo-identity-candidates": ["scripts/repo-identity-candidates.js"],
    "approve-repo-identity": ["scripts/approve-repo-identity.js"],
    "backup-readiness": ["scripts/backup-readiness-report.js"],
    "inventory-buckets": ["scripts/inventory-session-buckets.js"],
    "inventory-providers": ["scripts/inventory-provider-archive.js"],
    "logical-threads": ["scripts/logical-thread-report.js"],
    "build-graphs": ["scripts/build-graphs.js"],
    "validate-timeline": ["scripts/validate-session-timeline.js"],
};
if (command === "--version" || command === "-v" || command === "version") {
    console.log(version);
    process.exit(0);
}
if (command === "help" || command === "--help" || command === "-h") {
    console.log(`agent-session-store / astore commands:\n\n  status\n${Object.keys(scripts).sort().map((name) => `  ${name}`).join("\n")}\n\nOptions:\n  -v, --version   print the CLI version\n\nExamples:\n  astore status\n  astore build\n  astore export-graph\n  astore scan-repos\n  agent-session-store status\n`);
    process.exit(0);
}
if (command === "status") {
    const { statSync } = await import("node:fs");
    const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(process.env.HOME ?? ".", ".pi", "agent", "session-store");
    console.log(`agent-session-store root: ${root}`);
    console.log(`store dir: ${storeDir}`);
    for (const artifact of artifactPaths) {
        const path = join(storeDir, artifact);
        try {
            const st = statSync(path);
            console.log(`${artifact}: ${st.size} bytes, modified ${st.mtime.toISOString()}`);
        }
        catch {
            console.log(`${artifact}: missing`);
        }
    }
    process.exit(0);
}
const script = scripts[command];
if (!script) {
    console.error(`Unknown command: ${command}. Run agent-session-store help.`);
    process.exit(2);
}
const result = spawnSync(process.execPath, [...script, ...rest], { cwd: root, stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
//# sourceMappingURL=agent-session-store.js.map