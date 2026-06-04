#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const command = process.argv[2] ?? "help";
const rest = process.argv.slice(3);

const artifactPaths = [
	"session-store.sqlite",
	"session-store.export.json",
	"graph-export.json",
	"repo-identities.md",
];

const scripts: Record<string, string[]> = {
	build: ["scripts/build-curated-store.js"],
	"build-store": ["scripts/build-curated-store.js"],
	"export-graph": ["scripts/export-graph-json.js"],
	"scan-repos": ["scripts/scan-repo-identities.js"],
	"repo-identities": ["scripts/repo-identity-report.js"],
	"backup-readiness": ["scripts/backup-readiness-report.js"],
	"inventory-buckets": ["scripts/inventory-session-buckets.js"],
	"inventory-providers": ["scripts/inventory-provider-archive.js"],
	"logical-threads": ["scripts/logical-thread-report.js"],
	"build-graphs": ["scripts/build-graphs.js"],
	"validate-timeline": ["scripts/validate-session-timeline.js"],
};

if (command === "help" || command === "--help" || command === "-h") {
	console.log(`agent-session-store commands:\n\n  status\n${Object.keys(scripts).sort().map((name) => `  ${name}`).join("\n")}\n\nExamples:\n  agent-session-store status\n  agent-session-store build\n  agent-session-store export-graph\n  agent-session-store scan-repos\n`);
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
		} catch {
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
