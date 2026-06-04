#!/usr/bin/env node
import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(agentDir, "session-store");
const candidatesPath = join(storeDir, "repo-identity-candidates.json");
const sidecarPath = join(storeDir, "repo-identities.jsonl");

function option(name: string) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function flag(name: string) { return process.argv.includes(name); }
function usage(): never {
	console.error(`Usage:
  agent-session-store approve-repo-identity --candidate <id> [--stable-name name] [--display-name name] [--yes]
  agent-session-store approve-repo-identity --stable-name name --display-name name --path /a --path /b [--yes]
`);
	process.exit(2);
}
function stableId(stableName: string) { return `repo_identity_${stableName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`; }

const candidateId = option("--candidate");
let stableName = option("--stable-name");
let displayName = option("--display-name");
const paths: string[] = [];
for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === "--path" && process.argv[i + 1]) paths.push(process.argv[i + 1]);
let evidence: unknown = { source: "manual-approval" };

if (candidateId) {
	const data = JSON.parse(await readFile(candidatesPath, "utf8"));
	const candidate = data.candidates?.find((c: any) => c.id === candidateId);
	if (!candidate) throw new Error(`Candidate not found: ${candidateId}`);
	stableName ??= candidate.suggestedStableName;
	displayName ??= candidate.displayName;
	paths.push(...candidate.paths);
	evidence = { candidateId, confidence: candidate.confidence, evidence: candidate.evidence, metrics: candidate.metrics };
}
if (!stableName || !displayName || paths.length < 1) usage();
if (!flag("--yes")) {
	console.error(`Refusing to write without --yes. Would approve ${stableName}:\n${paths.map((p) => `- ${p}`).join("\n")}`);
	process.exit(3);
}
const id = stableId(stableName);
const now = new Date().toISOString();
const records = [
	{ kind: "repo-identity", id, stableName, displayName, confidence: "manual", metadata: { approvedAt: now, evidence } },
	...paths.map((path) => ({ kind: "repo-observation", repoIdentityId: id, stableName, path, confidence: "manual", evidence: JSON.stringify(evidence), metadata: { approvedAt: now, source: "approve-repo-identity" } })),
];
await appendFile(sidecarPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
console.log(`Appended ${records.length} repo identity records to ${sidecarPath}`);
