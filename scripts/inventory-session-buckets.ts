#!/usr/bin/env node
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const sessionsDir = join(agentDir, "sessions");
const codingSessionsDir = join(home, "Downloads", "coding-sessions");
const outDir = join(agentDir, "session-store");
const graphDir = join(agentDir, "session-graph");

type Bucket = { root: string; bucket: string; decodedPath?: string; exists?: boolean; sessionCount: number; earliest?: string; latest?: string; files: string[] };

async function exists(path: string) { try { await stat(path); return true; } catch { return false; } }
function decodeBucket(bucket: string): string | undefined {
	if (!bucket.startsWith("--") || !bucket.endsWith("--")) return undefined;
	const inner = bucket.slice(2, -2);
	if (!inner) return "/";
	if (inner.startsWith("Users-sam-")) return `/Users/sam/${inner.slice("Users-sam-".length).replaceAll("-", "/")}`;
	return `/${inner.replaceAll("-", "/")}`;
}
function tsFromFile(file: string) { return file.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/)?.[1]?.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z"); }
async function findSessionRoots(root: string): Promise<string[]> {
	const roots: string[] = [];
	async function walk(dir: string, depth: number) {
		if (depth > 6) return;
		const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
		if (entries.some((e) => e.isDirectory() && e.name.startsWith("--") && e.name.endsWith("--"))) roots.push(dir);
		for (const entry of entries) if (entry.isDirectory() && !["node_modules", ".git", ".jj"].includes(entry.name)) await walk(join(dir, entry.name), depth + 1);
	}
	if (await exists(root)) await walk(root, 0);
	return [...new Set(roots)].sort();
}
async function scanRoot(root: string): Promise<Bucket[]> {
	const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
	const buckets: Bucket[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory() || !entry.name.startsWith("--") || !entry.name.endsWith("--")) continue;
		const dir = join(root, entry.name);
		const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".jsonl")).sort();
		const times = files.map(tsFromFile).filter((v): v is string => Boolean(v)).sort();
		const decodedPath = decodeBucket(entry.name);
		buckets.push({ root, bucket: entry.name, decodedPath, exists: decodedPath ? await exists(decodedPath) : undefined, sessionCount: files.length, earliest: times[0], latest: times.at(-1), files: files.map((f) => join(dir, f)) });
	}
	return buckets.sort((a, b) => (b.sessionCount - a.sessionCount) || a.bucket.localeCompare(b.bucket));
}

const roots = [sessionsDir, ...(await findSessionRoots(codingSessionsDir))].filter((v, i, a) => a.indexOf(v) === i);
const buckets = (await Promise.all(roots.map(scanRoot))).flat();
const missing = buckets.filter((b) => b.decodedPath && b.exists === false);
const payload = { generatedAt: new Date().toISOString(), roots, bucketCount: buckets.length, missingCount: missing.length, buckets };
await mkdir(outDir, { recursive: true });
await mkdir(graphDir, { recursive: true });
await writeFile(join(outDir, "session-bucket-inventory.json"), JSON.stringify(payload, null, 2) + "\n");
const report = [
	"# Session bucket inventory",
	"",
	`Generated: ${payload.generatedAt}`,
	"",
	"## Roots",
	...roots.map((r) => `- ${r}`),
	"",
	`Buckets: ${buckets.length}`,
	`Missing decoded paths: ${missing.length}`,
	"",
	"## Missing/deprecated decoded paths",
	...missing.slice(0, 200).map((b) => `- ${b.decodedPath} (${b.sessionCount} sessions, ${b.earliest ?? "?"} → ${b.latest ?? "?"}, root=${b.root})`),
	missing.length > 200 ? `- ... ${missing.length - 200} more` : "",
	"",
	"## Largest buckets",
	...buckets.slice(0, 100).map((b) => `- ${b.decodedPath ?? b.bucket}: ${b.sessionCount} sessions, exists=${b.exists}, ${b.earliest ?? "?"} → ${b.latest ?? "?"}`),
	"",
	"Note: bucket decoding is lossy for hyphens vs path separators. Treat decoded paths as guesses unless corroborated by session cwd metadata or manifest/store labels.",
	"",
].join("\n");
await writeFile(join(outDir, "session-bucket-inventory.md"), report);
await writeFile(join(graphDir, "session-bucket-inventory.md"), report);
console.log(`Wrote ${join(outDir, "session-bucket-inventory.md")}`);
console.log(`Discovered ${buckets.length} buckets across ${roots.length} roots; ${missing.length} decoded paths missing.`);
