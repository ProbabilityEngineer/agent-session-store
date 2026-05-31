#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const home = process.env.HOME ?? ".";
const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(home, ".pi", "agent", "session-store");
const sidecar = join(storeDir, "repo-identities.jsonl");
const roots = (process.env.AGENT_REPO_ROOTS ?? join(home, "git")).split(":").filter(Boolean);

type Row = Record<string, unknown>;
function id(...parts: string[]) { return createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 16); }
async function exists(path: string) { try { await stat(path); return true; } catch { return false; } }
function normalizeGithubOrigin(url?: string) {
	if (!url) return undefined;
	const trimmed = url.trim().replace(/\.git$/i, "");
	const ssh = trimmed.match(/^git@github\.com:([^/]+)\/(.+)$/i);
	const https = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/(.+)$/i);
	const match = ssh ?? https;
	if (!match) return { raw: url };
	const owner = match[1]!.toLowerCase();
	const name = match[2]!.toLowerCase();
	return { raw: url, host: "github.com", owner, name, fullName: `${owner}/${name}`, canonicalUrl: `https://github.com/${owner}/${name}` };
}
async function git(cwd: string, args: string[]) { return (await execFileAsync("git", args, { cwd })).stdout.trim(); }
async function gitInfo(path: string) {
	const remote = await git(path, ["remote", "get-url", "origin"]).catch(() => "");
	const first = await git(path, ["log", "--format=%H%x00%cI%x00%s", "--reverse", "--max-count=1"]).catch(() => "");
	const last = await git(path, ["log", "--format=%H%x00%cI%x00%s", "--max-count=1"]).catch(() => "");
	const [firstHash, firstAt, firstSubject] = first.split("\0");
	const [lastHash, lastAt, lastSubject] = last.split("\0");
	return { remote, github: normalizeGithubOrigin(remote), firstHash, firstAt, firstSubject, lastHash, lastAt, lastSubject };
}
async function findRepos(root: string) {
	const out: string[] = [];
	async function walk(dir: string, depth: number) {
		if (depth > 4) return;
		const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
		if (entries.some((e) => e.isDirectory() && (e.name === ".git" || e.name === ".jj"))) { out.push(dir); return; }
		for (const e of entries) if (e.isDirectory() && !["node_modules", "dist", "target", ".git", ".jj"].includes(e.name)) await walk(join(dir, e.name), depth + 1);
	}
	if (await exists(root)) await walk(root, 0);
	return out;
}
async function readRows() { try { return (await readFile(sidecar, "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row); } catch { return []; } }
const existing = await readRows();
const seen = new Set(existing.map((r) => JSON.stringify(r)));
const additions: Row[] = [];
const observedAt = new Date().toISOString();
for (const root of roots) for (const path of await findRepos(root)) {
	const info = await gitInfo(path);
	const stableName = info.github?.fullName ? `github:${info.github.fullName}` : `path:${path}`;
	const identity = { kind: "repo-identity", stableName, displayName: basename(path), confidence: "observed", metadata: { source: "repo-scan", observedAt } };
	const observation = { kind: "repo-observation", stableName, path, remoteUrl: info.remote || undefined, validFrom: observedAt, confidence: "observed", metadata: { source: "repo-scan", observedAt, github: info.github, firstCommit: info.firstHash, firstCommitAt: info.firstAt, firstSubject: info.firstSubject, lastCommit: info.lastHash, lastCommitAt: info.lastAt, lastSubject: info.lastSubject, vcs: await exists(join(path, ".jj")) ? "git+jj" : "git" } };
	for (const row of [identity, observation]) {
		const key = JSON.stringify(row);
		if (!seen.has(key)) { seen.add(key); additions.push(row); }
	}
}
await mkdir(storeDir, { recursive: true });
if (additions.length) await writeFile(sidecar, additions.map((r) => JSON.stringify(r)).join("\n") + "\n", { flag: "a" });
console.log(`Wrote ${additions.length} repo identity sidecar records to ${sidecar}`);
