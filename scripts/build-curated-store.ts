#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { execFile } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const graphDir = join(agentDir, "session-graph");
const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(agentDir, "session-store");
const sessionsDir = join(agentDir, "sessions");
const manifestPath = join(agentDir, "relocations.jsonl");
const overlaysPath = join(graphDir, "lineage-overlays.jsonl");
const preManifestPath = join(graphDir, "pre-manifest-lineage.json");
const prefixLineagePath = join(graphDir, "prefix-lineage.json");
const inventoryPath = join(graphDir, "temporal-inventory.json");
const oldExtensionsDir = join(home, "git", "agents", "x-pi-old-extensions");
const sqlitePath = join(storeDir, "session-store.sqlite");

type Json = Record<string, unknown>;

type RelocationRecord = {
	ts: string;
	fromCwd: string;
	toCwd: string;
	sourceSession: string;
	destinationSession: string;
	parent?: string;
	replacements?: number | null;
	inferred?: boolean;
	confidence?: string;
	sourceSessionId?: string;
	destinationSessionId?: string;
	mode?: "move" | "branch";
	batchId?: string;
};

type OverlayRecord =
	| { kind: "root"; session: string; historicalCwd?: string; label?: string; confidence?: string; evidence?: string[]; notes?: string[] }
	| { kind: "edge"; source: string; destination: string; fromCwd?: string; toCwd?: string; ts?: string; confidence?: string; lineageKind?: string; evidence?: string[]; notes?: string[] }
	| { kind: "alias"; path: string; label: string; note?: string }
	| { kind: "session-label"; session?: string; sessionId?: string; cwd?: string; label?: string; source?: string; confidence?: string; note?: string }
	| { kind: "classification"; manifestIndex: number; lineageKind?: string; recordConfidence?: string; continuationConfidence?: string; displayLabel?: string; notes?: string[]; evidence?: string[] };

type Store = {
	schemaVersion: 1;
	generatedAt: string;
	inputs: Record<string, string>;
	sources: Source[];
	importRuns: ImportRun[];
	sessions: Session[];
	sessionObservations: SessionObservation[];
	edges: Edge[];
	labels: Label[];
	aliases: Alias[];
	classifications: Classification[];
	evidence: Evidence[];
	backupObservations: BackupObservation[];
	repositories: Repository[];
	artifacts: Artifact[];
	observationMarks: ObservationMark[];
	batchOperations: BatchOperation[];
	logicalThreads: LogicalThread[];
	threadMembers: ThreadMember[];
	threadEdges: ThreadEdge[];
};

type Source = { id: string; provider: string; kind: string; uri: string; label?: string; firstObservedAt?: string; lastObservedAt?: string; metadata?: Json };
type ImportRun = { id: string; sourceId: string; startedAt: string; finishedAt: string; tool: string; status: string; stats?: Json; notes?: string };
type Session = { id: string; provider: string; providerSessionId?: string; canonicalKey: string; firstSeenAt?: string; lastSeenAt?: string; startTimestamp?: string; endTimestamp?: string; lineCount?: number; byteCount?: number; contentSha256?: string; metadata?: Json };
type SessionObservation = { id: string; sessionId: string; sourceId: string; path: string; providerSessionId?: string; observedAt?: string; snapshotLabel?: string; fileBirthtime?: string; fileMtime?: string; fileSize?: number; lineCount?: number; firstEventAt?: string; lastEventAt?: string; contentSha256?: string; metadata?: Json };
type Edge = { id: string; sourceSessionId: string; targetSessionId: string; edgeType: string; timestamp?: string; sourceObservationId?: string; targetObservationId?: string; confidence: string; provenance: string; metadata?: Json };
type Label = { id: string; targetType: string; targetId: string; labelType: string; value: string; confidence: string; sourceId?: string; evidenceId?: string; metadata?: Json };
type Alias = { id: string; aliasType: string; fromValue: string; toValue: string; confidence: string; evidenceId?: string; notes?: string };
type Classification = { id: string; targetType: string; targetId: string; classification: string; confidence: string; source: string; evidenceId?: string; notes?: string; metadata?: Json };
type Evidence = { id: string; kind: string; sourceId?: string; targetType?: string; targetId?: string; timestamp?: string; confidence: string; summary: string; data?: Json };
type BackupObservation = { id: string; sourceId: string; sessionObservationId?: string; snapshotLabel: string; snapshotTimestamp?: string; path: string; presence: "present" | "absent"; fileMtime?: string; fileBirthtime?: string; fileSize?: number; lineCount?: number; metadata?: Json };
type Repository = { id: string; sourceId: string; path: string; name: string; remoteUrl?: string; vcs: string; firstCommitAt?: string; lastCommitAt?: string; firstCommit?: string; lastCommit?: string; metadata?: Json };
type Artifact = { id: string; kind: string; path: string; generatedAt: string; generator: string; inputHash?: string; metadata?: Json };
type ObservationMark = { id: string; observationId: string; markType: string; reason?: string; replacementObservationId?: string; source: string; timestamp: string; confidence: string; manualReviewRequired: boolean; metadata?: Json };
type BatchOperation = { id: string; operationType: string; sourcePath: string; destinationPath: string; timestamp: string; source: string; status: string; metadata?: Json };
type LogicalThread = { id: string; label?: string; confidence: string; source: string; metadata?: Json };
type ThreadMember = { id: string; threadId: string; sessionId: string; observationId?: string; role: string; ordinal: number; metadata?: Json };
type ThreadEdge = { id: string; threadId: string; sourceSessionId: string; targetSessionId: string; relation: string; edgeId?: string; confidence: string; source: string; metadata?: Json };

function sha(text: string) { return createHash("sha256").update(text).digest("hex"); }
function id(prefix: string, ...parts: (string | undefined)[]) { return `${prefix}_${sha(parts.filter(Boolean).join("\u0000")).slice(0, 16)}`; }
function sessionIdFromPath(path: string) { return basename(path).match(/_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:_|\.|$)/)?.[1]; }
function sessionStartTimestamp(path: string) { return basename(path).match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/)?.[1]?.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z"); }
async function exists(path: string) { try { await stat(path); return true; } catch { return false; } }
async function readJsonl<T>(path: string): Promise<T[]> { if (!(await exists(path))) return []; const raw = await readFile(path, "utf8"); return raw.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line) as T); }
async function readJson<T>(path: string): Promise<T | undefined> { if (!(await exists(path))) return undefined; return JSON.parse(await readFile(path, "utf8")) as T; }
function rowTimestamp(row: Json): string | undefined { for (const key of ["timestamp", "ts", "createdAt", "created_at"]) if (typeof row[key] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(row[key])) return row[key] as string; const msg = row.message as Json | undefined; return typeof msg?.timestamp === "string" ? msg.timestamp : undefined; }
function rowCwd(row: Json): string | undefined { if (typeof row.cwd === "string") return row.cwd; const session = row.session as Json | undefined; return typeof session?.cwd === "string" ? session.cwd : undefined; }
function rowDisplayName(row: Json): string | undefined {
	for (const key of ["displayName", "display_name", "name", "sessionName", "session_name"]) if (typeof row[key] === "string" && row[key].trim()) return row[key] as string;
	const session = row.session as Json | undefined;
	for (const key of ["displayName", "display_name", "name", "sessionName", "session_name"]) if (typeof session?.[key] === "string" && String(session[key]).trim()) return session[key] as string;
	return undefined;
}

async function sessionObservation(path: string, sourceId: string): Promise<{ session: Session; observation: SessionObservation }> {
	const providerSessionId = sessionIdFromPath(path);
	const sessionId = id("session", "pi", path);
	let lineCount = 0;
	let firstEventAt: string | undefined;
	let lastEventAt: string | undefined;
	let cwd: string | undefined;
	let displayName: string | undefined;
	let contentSha256: string | undefined;
	let fileSize: number | undefined;
	let fileBirthtime: string | undefined;
	let fileMtime: string | undefined;
	if (await exists(path)) {
		const [raw, st] = await Promise.all([readFile(path, "utf8"), stat(path)]);
		contentSha256 = sha(raw);
		fileSize = st.size;
		fileBirthtime = st.birthtime.toISOString();
		fileMtime = st.mtime.toISOString();
		for (const line of raw.split("\n")) {
			if (!line.trim()) continue;
			lineCount++;
			try {
				const row = JSON.parse(line) as Json;
				const ts = rowTimestamp(row);
				if (ts) { firstEventAt ??= ts; lastEventAt = ts; }
				const candidate = rowCwd(row);
				if (candidate && (!cwd || candidate.length > cwd.length)) cwd = candidate;
				displayName ??= rowDisplayName(row);
			} catch { /* metadata-only scan tolerates malformed rows */ }
		}
	}
	return {
		session: { id: sessionId, provider: "pi", providerSessionId, canonicalKey: path, firstSeenAt: firstEventAt ?? sessionStartTimestamp(path), lastSeenAt: lastEventAt, startTimestamp: sessionStartTimestamp(path), endTimestamp: lastEventAt, lineCount, byteCount: fileSize, contentSha256, metadata: { ...(cwd ? { cwd } : {}), ...(displayName ? { displayName } : {}) } },
		observation: { id: id("obs", sourceId, path), sessionId, sourceId, path, providerSessionId, fileBirthtime, fileMtime, fileSize, lineCount, firstEventAt, lastEventAt, contentSha256, metadata: { ...(cwd ? { cwd } : {}), ...(displayName ? { displayName } : {}) } },
	};
}

async function listSessionFiles(dir = sessionsDir): Promise<string[]> {
	if (!(await exists(dir))) return [];
	const out: string[] = [];
	for (const bucket of await readdir(dir, { withFileTypes: true })) {
		if (!bucket.isDirectory()) continue;
		const bucketDir = join(dir, bucket.name);
		for (const entry of await readdir(bucketDir, { withFileTypes: true })) if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(join(bucketDir, entry.name));
	}
	return out.sort();
}

async function gitInfo(path: string) {
	try {
		const first = (await execFileAsync("git", ["log", "--format=%H%x00%cI%x00%s", "--reverse", "--max-count=1"], { cwd: path })).stdout.trim();
		const last = (await execFileAsync("git", ["log", "--format=%H%x00%cI%x00%s", "--max-count=1"], { cwd: path })).stdout.trim();
		const remote = (await execFileAsync("git", ["remote", "get-url", "origin"], { cwd: path }).catch(() => ({ stdout: "" }))).stdout.trim();
		const [firstHash, firstAt, firstSubject] = first.split("\0");
		const [lastHash, lastAt, lastSubject] = last.split("\0");
		return { firstHash, firstAt, firstSubject, lastHash, lastAt, lastSubject, remote };
	} catch { return undefined; }
}

async function findGitRoots(root: string): Promise<string[]> {
	if (!(await exists(root))) return [];
	const found: string[] = [];
	async function walk(dir: string, depth: number) {
		if (depth > 4) return;
		const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
		if (entries.some((entry) => entry.isDirectory() && entry.name === ".git")) { found.push(dir); return; }
		for (const entry of entries) if (entry.isDirectory() && !["node_modules", "target", "dist", ".jj", ".git"].includes(entry.name)) await walk(join(dir, entry.name), depth + 1);
	}
	await walk(root, 0);
	return found.sort();
}

function pushUnique<T extends { id: string }>(array: T[], seen: Set<string>, item: T) { if (!seen.has(item.id)) { seen.add(item.id); array.push(item); } }
function json(value: unknown) { return JSON.stringify(value ?? {}); }

class DisjointSet {
	parents = new Map<string, string>();
	find(value: string): string {
		const parent = this.parents.get(value) ?? value;
		if (parent === value) { this.parents.set(value, value); return value; }
		const root = this.find(parent);
		this.parents.set(value, root);
		return root;
	}
	union(a: string, b: string) { this.parents.set(this.find(a), this.find(b)); }
}

function deriveLogicalThreads(store: Store) {
	const ds = new DisjointSet();
	for (const session of store.sessions) ds.find(session.id);
	for (const edge of store.edges) ds.union(edge.sourceSessionId, edge.targetSessionId);
	const byProviderSession = new Map<string, string[]>();
	for (const session of store.sessions) {
		if (!session.providerSessionId) continue;
		const list = byProviderSession.get(session.providerSessionId) ?? [];
		list.push(session.id);
		byProviderSession.set(session.providerSessionId, list);
	}
	for (const ids of byProviderSession.values()) for (const id of ids.slice(1)) ds.union(ids[0]!, id);
	const groups = new Map<string, Session[]>();
	for (const session of store.sessions) {
		const group = groups.get(ds.find(session.id)) ?? [];
		group.push(session);
		groups.set(ds.find(session.id), group);
	}
	for (const group of groups.values()) {
		group.sort((a, b) => (a.startTimestamp ?? a.firstSeenAt ?? "").localeCompare(b.startTimestamp ?? b.firstSeenAt ?? "") || a.id.localeCompare(b.id));
		const threadId = id("thread", ...group.map((session) => session.id).sort());
		const label = String(group.find((session) => typeof session.metadata?.displayName === "string")?.metadata?.displayName ?? group.find((session) => typeof session.metadata?.cwd === "string")?.metadata?.cwd ?? group[0]?.providerSessionId ?? threadId);
		store.logicalThreads.push({ id: threadId, label, confidence: "medium", source: "derived-relocation-provider-session", metadata: { sessionCount: group.length, providerSessionIds: [...new Set(group.map((session) => session.providerSessionId).filter(Boolean))] } });
		for (const [ordinal, session] of group.entries()) {
			const observation = store.sessionObservations.find((obs) => obs.sessionId === session.id);
			store.threadMembers.push({ id: id("thread_member", threadId, session.id), threadId, sessionId: session.id, observationId: observation?.id, role: ordinal === 0 ? "root" : "member", ordinal, metadata: { cwd: session.metadata?.cwd } });
		}
	}
	const threadBySession = new Map<string, string>();
	for (const member of store.threadMembers) threadBySession.set(member.sessionId, member.threadId);
	for (const edge of store.edges) {
		const threadId = threadBySession.get(edge.sourceSessionId);
		if (!threadId || threadBySession.get(edge.targetSessionId) !== threadId) continue;
		const classification = store.classifications.find((item) => item.targetType === "edge" && item.targetId === edge.id)?.classification;
		const relation = classification?.includes("context") ? "context_jump" : edge.edgeType === "branch" ? "fork" : "continuation";
		store.threadEdges.push({ id: id("thread_edge", threadId, edge.id), threadId, sourceSessionId: edge.sourceSessionId, targetSessionId: edge.targetSessionId, relation, edgeId: edge.id, confidence: edge.confidence, source: edge.provenance, metadata: { classification, edgeType: edge.edgeType } });
	}
}

function initSqlite(db: DatabaseSync) {
	db.exec(`
CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, provider TEXT NOT NULL, kind TEXT NOT NULL, uri TEXT NOT NULL, label TEXT, first_observed_at TEXT, last_observed_at TEXT, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS import_runs (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, tool TEXT NOT NULL, status TEXT NOT NULL, stats_json TEXT NOT NULL DEFAULT '{}', notes TEXT);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_session_id TEXT, canonical_key TEXT NOT NULL UNIQUE, first_seen_at TEXT, last_seen_at TEXT, start_timestamp TEXT, end_timestamp TEXT, event_count INTEGER, line_count INTEGER, byte_count INTEGER, content_sha256 TEXT, prefix_sha256 TEXT, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS session_observations (id TEXT PRIMARY KEY, session_id TEXT, source_id TEXT, path TEXT, provider_session_id TEXT, observed_at TEXT, snapshot_label TEXT, file_birthtime TEXT, file_mtime TEXT, file_size INTEGER, line_count INTEGER, first_event_at TEXT, last_event_at TEXT, content_sha256 TEXT, prefix_sha256 TEXT, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, session_id TEXT, source_id TEXT, provider TEXT NOT NULL, provider_event_id TEXT, event_type TEXT NOT NULL, timestamp TEXT, ordinal INTEGER, role TEXT, tool_name TEXT, summary TEXT, content_sha256 TEXT, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS edges (id TEXT PRIMARY KEY, source_session_id TEXT, target_session_id TEXT, edge_type TEXT NOT NULL, timestamp TEXT, source_observation_id TEXT, target_observation_id TEXT, confidence TEXT NOT NULL, provenance TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS labels (id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, label_type TEXT NOT NULL, value TEXT NOT NULL, valid_from TEXT, valid_to TEXT, confidence TEXT NOT NULL, source_id TEXT, evidence_id TEXT, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS aliases (id TEXT PRIMARY KEY, alias_type TEXT NOT NULL, from_value TEXT NOT NULL, to_value TEXT NOT NULL, valid_from TEXT, valid_to TEXT, confidence TEXT NOT NULL, evidence_id TEXT, notes TEXT);
CREATE TABLE IF NOT EXISTS classifications (id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, classification TEXT NOT NULL, confidence TEXT NOT NULL, source TEXT NOT NULL, evidence_id TEXT, notes TEXT, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, kind TEXT NOT NULL, source_id TEXT, target_type TEXT, target_id TEXT, timestamp TEXT, confidence TEXT NOT NULL, summary TEXT NOT NULL, data_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS backup_observations (id TEXT PRIMARY KEY, source_id TEXT, session_observation_id TEXT, snapshot_label TEXT NOT NULL, snapshot_timestamp TEXT, path TEXT NOT NULL, presence TEXT NOT NULL, file_mtime TEXT, file_birthtime TEXT, file_size INTEGER, line_count INTEGER, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS repositories (id TEXT PRIMARY KEY, source_id TEXT, path TEXT NOT NULL, name TEXT, remote_url TEXT, vcs TEXT, first_commit_at TEXT, last_commit_at TEXT, first_commit TEXT, last_commit TEXT, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, kind TEXT NOT NULL, path TEXT NOT NULL, generated_at TEXT NOT NULL, generator TEXT NOT NULL, input_hash TEXT, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS observation_marks (id TEXT PRIMARY KEY, observation_id TEXT NOT NULL, mark_type TEXT NOT NULL, reason TEXT, replacement_observation_id TEXT, source TEXT NOT NULL, timestamp TEXT NOT NULL, confidence TEXT NOT NULL, manual_review_required INTEGER NOT NULL DEFAULT 1, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS batch_operations (id TEXT PRIMARY KEY, operation_type TEXT NOT NULL, source_path TEXT NOT NULL, destination_path TEXT NOT NULL, timestamp TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS logical_threads (id TEXT PRIMARY KEY, label TEXT, confidence TEXT NOT NULL, source TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS thread_members (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, session_id TEXT NOT NULL, observation_id TEXT, role TEXT NOT NULL, ordinal INTEGER NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS thread_edges (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, source_session_id TEXT NOT NULL, target_session_id TEXT NOT NULL, relation TEXT NOT NULL, edge_id TEXT, confidence TEXT NOT NULL, source TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
`);
}

function replaceSqlite(dbPath: string, store: Store) {
	const db = new DatabaseSync(dbPath);
	try {
		db.exec("PRAGMA journal_mode = WAL");
		initSqlite(db);
		db.exec("BEGIN");
		for (const table of ["sources", "import_runs", "sessions", "session_observations", "events", "edges", "labels", "aliases", "classifications", "evidence", "backup_observations", "repositories", "artifacts", "observation_marks", "batch_operations", "logical_threads", "thread_members", "thread_edges"]) db.exec(`DELETE FROM ${table}`);
		const sourceStmt = db.prepare("INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.sources) sourceStmt.run(r.id, r.provider, r.kind, r.uri, r.label ?? null, r.firstObservedAt ?? null, r.lastObservedAt ?? null, json(r.metadata));
		const runStmt = db.prepare("INSERT INTO import_runs VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.importRuns) runStmt.run(r.id, r.sourceId, r.startedAt, r.finishedAt, r.tool, r.status, json(r.stats), r.notes ?? null);
		const sessionStmt = db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.sessions) sessionStmt.run(r.id, r.provider, r.providerSessionId ?? null, r.canonicalKey, r.firstSeenAt ?? null, r.lastSeenAt ?? null, r.startTimestamp ?? null, r.endTimestamp ?? null, null, r.lineCount ?? null, r.byteCount ?? null, r.contentSha256 ?? null, null, json(r.metadata));
		const obsStmt = db.prepare("INSERT INTO session_observations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.sessionObservations) obsStmt.run(r.id, r.sessionId, r.sourceId, r.path, r.providerSessionId ?? null, r.observedAt ?? null, r.snapshotLabel ?? null, r.fileBirthtime ?? null, r.fileMtime ?? null, r.fileSize ?? null, r.lineCount ?? null, r.firstEventAt ?? null, r.lastEventAt ?? null, r.contentSha256 ?? null, null, json(r.metadata));
		const edgeStmt = db.prepare("INSERT INTO edges VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.edges) edgeStmt.run(r.id, r.sourceSessionId, r.targetSessionId, r.edgeType, r.timestamp ?? null, r.sourceObservationId ?? null, r.targetObservationId ?? null, r.confidence, r.provenance, json(r.metadata));
		const labelStmt = db.prepare("INSERT INTO labels VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.labels) labelStmt.run(r.id, r.targetType, r.targetId, r.labelType, r.value, null, null, r.confidence, r.sourceId ?? null, r.evidenceId ?? null, json(r.metadata));
		const aliasStmt = db.prepare("INSERT INTO aliases VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.aliases) aliasStmt.run(r.id, r.aliasType, r.fromValue, r.toValue, null, null, r.confidence, r.evidenceId ?? null, r.notes ?? null);
		const classStmt = db.prepare("INSERT INTO classifications VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.classifications) classStmt.run(r.id, r.targetType, r.targetId, r.classification, r.confidence, r.source, r.evidenceId ?? null, r.notes ?? null, json(r.metadata));
		const evidenceStmt = db.prepare("INSERT INTO evidence VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.evidence) evidenceStmt.run(r.id, r.kind, r.sourceId ?? null, r.targetType ?? null, r.targetId ?? null, r.timestamp ?? null, r.confidence, r.summary, json(r.data));
		const backupStmt = db.prepare("INSERT INTO backup_observations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.backupObservations) backupStmt.run(r.id, r.sourceId, r.sessionObservationId ?? null, r.snapshotLabel, r.snapshotTimestamp ?? null, r.path, r.presence, r.fileMtime ?? null, r.fileBirthtime ?? null, r.fileSize ?? null, r.lineCount ?? null, json(r.metadata));
		const repoStmt = db.prepare("INSERT INTO repositories VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.repositories) repoStmt.run(r.id, r.sourceId, r.path, r.name, r.remoteUrl ?? null, r.vcs, r.firstCommitAt ?? null, r.lastCommitAt ?? null, r.firstCommit ?? null, r.lastCommit ?? null, json(r.metadata));
		const artifactStmt = db.prepare("INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.artifacts) artifactStmt.run(r.id, r.kind, r.path, r.generatedAt, r.generator, r.inputHash ?? null, json(r.metadata));
		const markStmt = db.prepare("INSERT INTO observation_marks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.observationMarks) markStmt.run(r.id, r.observationId, r.markType, r.reason ?? null, r.replacementObservationId ?? null, r.source, r.timestamp, r.confidence, r.manualReviewRequired ? 1 : 0, json(r.metadata));
		const batchStmt = db.prepare("INSERT INTO batch_operations VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.batchOperations) batchStmt.run(r.id, r.operationType, r.sourcePath, r.destinationPath, r.timestamp, r.source, r.status, json(r.metadata));
		const threadStmt = db.prepare("INSERT INTO logical_threads VALUES (?, ?, ?, ?, ?)");
		for (const r of store.logicalThreads) threadStmt.run(r.id, r.label ?? null, r.confidence, r.source, json(r.metadata));
		const memberStmt = db.prepare("INSERT INTO thread_members VALUES (?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.threadMembers) memberStmt.run(r.id, r.threadId, r.sessionId, r.observationId ?? null, r.role, r.ordinal, json(r.metadata));
		const threadEdgeStmt = db.prepare("INSERT INTO thread_edges VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.threadEdges) threadEdgeStmt.run(r.id, r.threadId, r.sourceSessionId, r.targetSessionId, r.relation, r.edgeId ?? null, r.confidence, r.source, json(r.metadata));
		db.exec("COMMIT");
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	} finally {
		db.close();
	}
}

async function main() {
	const generatedAt = new Date().toISOString();
	const manifest = await readJsonl<RelocationRecord>(manifestPath);
	const overlays = await readJsonl<OverlayRecord>(overlaysPath);
	const preManifest = await readJson<Json>(preManifestPath);
	const prefixLineage = await readJson<Json>(prefixLineagePath);
	const inventory = await readJson<Json>(inventoryPath);

	const store: Store = { schemaVersion: 1, generatedAt, inputs: { agentDir, sessionsDir, manifestPath, overlaysPath, preManifestPath, prefixLineagePath, inventoryPath, oldExtensionsDir }, sources: [], importRuns: [], sessions: [], sessionObservations: [], edges: [], labels: [], aliases: [], classifications: [], evidence: [], backupObservations: [], repositories: [], artifacts: [], observationMarks: [], batchOperations: [], logicalThreads: [], threadMembers: [], threadEdges: [] };
	const seen = { sources: new Set<string>(), sessions: new Set<string>(), obs: new Set<string>(), edges: new Set<string>(), labels: new Set<string>(), aliases: new Set<string>(), classes: new Set<string>(), evidence: new Set<string>(), backups: new Set<string>(), repos: new Set<string>(), artifacts: new Set<string>(), marks: new Set<string>(), batches: new Set<string>() };
	const addSource = (provider: string, kind: string, uri: string, label?: string, metadata?: Json) => { const source: Source = { id: id("source", provider, kind, uri), provider, kind, uri, label, metadata }; pushUnique(store.sources, seen.sources, source); return source.id; };
	const liveSource = addSource("pi", "live_sessions", sessionsDir, "Pi live sessions");
	const manifestSource = addSource("pi", "relocation_manifest", manifestPath, "Pi relocation manifest");
	const overlaySource = addSource("manual-curation", "manual_overlay", overlaysPath, "Lineage overlays");
	const preSource = addSource("manual-curation", "curated_report", preManifestPath, "Pre-manifest lineage report");
	const prefixSource = addSource("manual-curation", "curated_report", prefixLineagePath, "Prefix lineage report");
	const oldRepoSource = addSource("git-repository", "repository_collection", oldExtensionsDir, "Old extension repositories");
	store.importRuns.push({ id: id("run", generatedAt, "build-curated-store"), sourceId: liveSource, startedAt: generatedAt, finishedAt: generatedAt, tool: "scripts/build-curated-store.ts", status: "ok", stats: { manifestRecords: manifest.length, overlayRecords: overlays.length } });

	const paths = new Set<string>(await listSessionFiles());
	for (const record of manifest) { paths.add(record.sourceSession); paths.add(record.destinationSession); }
	for (const record of overlays) {
		if (record.kind === "root") paths.add(record.session);
		if (record.kind === "edge") { paths.add(record.source); paths.add(record.destination); }
		if (record.kind === "session-label" && record.session) paths.add(record.session);
	}
	const obsByPath = new Map<string, SessionObservation>();
	const sessionByPath = new Map<string, Session>();
	for (const path of [...paths].sort()) {
		const source = path.includes("/Downloads/session-backups/") ? addSource("backup-snapshot", "backup_snapshot", path.split("/Macintosh HD/")[0], basename(path.split("/Macintosh HD/")[0])) : liveSource;
		const { session, observation } = await sessionObservation(path, source);
		pushUnique(store.sessions, seen.sessions, session);
		pushUnique(store.sessionObservations, seen.obs, observation);
		if (typeof session.metadata?.displayName === "string") pushUnique(store.labels, seen.labels, { id: id("label", "display", session.id, session.metadata.displayName), targetType: "session", targetId: session.id, labelType: "display_name", value: session.metadata.displayName, confidence: "authoritative", sourceId: source });
		obsByPath.set(path, observation);
		sessionByPath.set(path, session);
	}

	manifest.forEach((record, index) => {
		const source = sessionByPath.get(record.sourceSession);
		const target = sessionByPath.get(record.destinationSession);
		if (!source || !target) return;
		const edgeId = id("edge", "manifest", String(index), record.ts, record.sourceSession, record.destinationSession);
		const sourceObservationId = obsByPath.get(record.sourceSession)?.id;
		const targetObservationId = obsByPath.get(record.destinationSession)?.id;
		pushUnique(store.edges, seen.edges, { id: edgeId, sourceSessionId: source.id, targetSessionId: target.id, edgeType: record.mode === "branch" ? "branch" : "relocation", timestamp: record.ts, sourceObservationId, targetObservationId, confidence: record.inferred ? (record.confidence ?? "medium") : "authoritative", provenance: "pi-relocate-manifest", metadata: { manifestIndex: index, fromCwd: record.fromCwd, toCwd: record.toCwd, replacements: record.replacements, parent: record.parent, sourceSessionId: record.sourceSessionId, destinationSessionId: record.destinationSessionId, mode: record.mode ?? "move", batchId: record.batchId } });
		if (record.batchId) pushUnique(store.batchOperations, seen.batches, { id: record.batchId, operationType: "bucket_relocation", sourcePath: record.fromCwd, destinationPath: record.toCwd, timestamp: record.ts, source: "pi-relocate", status: "applied", metadata: { mode: record.mode ?? "move" } });
		if ((record.mode ?? "move") === "move" && sourceObservationId && targetObservationId) {
			pushUnique(store.observationMarks, seen.marks, { id: id("mark", sourceObservationId, "superseded", targetObservationId, record.ts), observationId: sourceObservationId, markType: "superseded", reason: "relocated by pi-relocate move semantics", replacementObservationId: targetObservationId, source: "pi-relocate-manifest", timestamp: record.ts, confidence: record.inferred ? (record.confidence ?? "medium") : "authoritative", manualReviewRequired: true, metadata: { batchId: record.batchId } });
			pushUnique(store.observationMarks, seen.marks, { id: id("mark", sourceObservationId, "deletion_candidate", targetObservationId, record.ts), observationId: sourceObservationId, markType: "deletion_candidate", reason: "old copy after relocation; requires manual review before deletion", replacementObservationId: targetObservationId, source: "pi-relocate-manifest", timestamp: record.ts, confidence: record.inferred ? (record.confidence ?? "medium") : "authoritative", manualReviewRequired: true, metadata: { batchId: record.batchId } });
		}
		for (const [type, value, targetId] of [["cwd", record.fromCwd, source.id], ["cwd", record.toCwd, target.id]] as const) if (value && !value.startsWith("(")) pushUnique(store.labels, seen.labels, { id: id("label", edgeId, type, targetId, value), targetType: "session", targetId, labelType: type, value, confidence: "authoritative", sourceId: manifestSource });
	});

	for (const record of overlays) {
		if (record.kind === "edge") {
			const source = sessionByPath.get(record.source); const target = sessionByPath.get(record.destination); if (!source || !target) continue;
			const edgeId = id("edge", "overlay", record.source, record.destination, record.ts);
			pushUnique(store.edges, seen.edges, { id: edgeId, sourceSessionId: source.id, targetSessionId: target.id, edgeType: record.lineageKind ?? "curated", timestamp: record.ts, sourceObservationId: obsByPath.get(record.source)?.id, targetObservationId: obsByPath.get(record.destination)?.id, confidence: record.confidence ?? "manual", provenance: "lineage-overlays", metadata: { fromCwd: record.fromCwd, toCwd: record.toCwd, evidence: record.evidence, notes: record.notes } });
		} else if (record.kind === "session-label") {
			const target = record.session ? sessionByPath.get(record.session) : undefined;
			if (target && record.label) pushUnique(store.labels, seen.labels, { id: id("label", "overlay", target.id, record.label), targetType: "session", targetId: target.id, labelType: "cwd", value: record.label, confidence: record.confidence ?? "manual", sourceId: overlaySource, metadata: { cwd: record.cwd, source: record.source, note: record.note } });
		} else if (record.kind === "alias") {
			pushUnique(store.aliases, seen.aliases, { id: id("alias", record.path, record.label), aliasType: "path", fromValue: record.path, toValue: record.label, confidence: "manual", notes: record.note });
		} else if (record.kind === "classification") {
			const edge = store.edges.find((item) => item.metadata?.manifestIndex === record.manifestIndex);
			if (edge && record.lineageKind) pushUnique(store.classifications, seen.classes, { id: id("class", edge.id, record.lineageKind), targetType: "edge", targetId: edge.id, classification: record.lineageKind, confidence: record.recordConfidence ?? "manual", source: "lineage-overlays", notes: record.notes?.join("\n"), metadata: { continuationConfidence: record.continuationConfidence, displayLabel: record.displayLabel, evidence: record.evidence } });
		}
	}

	const backupEvidence = preManifest?.backupEvidence as Json | undefined;
	if (backupEvidence) {
		for (const [key, value] of Object.entries(backupEvidence)) {
			const data = value as Json;
			const evId = id("evidence", "backup", key);
			pushUnique(store.evidence, seen.evidence, { id: evId, kind: "backup_presence", sourceId: preSource, confidence: "high", summary: `Backup evidence: ${key}`, data });
			for (const [field, presence] of [["presentAtBst", "present"], ["absentAtBst", "absent"]] as const) if (typeof data[field] === "string") pushUnique(store.backupObservations, seen.backups, { id: id("backup", key, field, String(data[field])), sourceId: preSource, snapshotLabel: String(data[field]), path: String(data.rootSession ?? data.session ?? data.sourceSession ?? data.destinationSession ?? key), presence, fileMtime: typeof data.fileMtimeUtc === "string" ? data.fileMtimeUtc : undefined, metadata: data });
		}
	}
	if (prefixLineage) pushUnique(store.evidence, seen.evidence, { id: id("evidence", "prefix-lineage", prefixLineagePath), kind: "prefix_match", sourceId: prefixSource, confidence: "medium", summary: "Prefix lineage report imported as evidence", data: { generatedAt: prefixLineage.generatedAt } });
	if (inventory) pushUnique(store.artifacts, seen.artifacts, { id: id("artifact", inventoryPath), kind: "inventory", path: inventoryPath, generatedAt, generator: "scripts/build-temporal-lineage.ts", metadata: { imported: true } });

	for (const repoPath of await findGitRoots(oldExtensionsDir)) {
		const info = await gitInfo(repoPath);
		const sourceId = addSource("git-repository", "git_repository", repoPath, relative(oldExtensionsDir, repoPath));
		pushUnique(store.repositories, seen.repos, { id: id("repo", repoPath), sourceId, path: repoPath, name: basename(repoPath), remoteUrl: info?.remote, vcs: (await exists(join(repoPath, ".jj"))) ? "git+jj" : "git", firstCommitAt: info?.firstAt, lastCommitAt: info?.lastAt, firstCommit: info?.firstHash, lastCommit: info?.lastHash, metadata: { firstSubject: info?.firstSubject, lastSubject: info?.lastSubject } });
		if (info) pushUnique(store.evidence, seen.evidence, { id: id("evidence", "git", repoPath), kind: "git_activity", sourceId: oldRepoSource, timestamp: info.lastAt, confidence: "high", summary: `${relative(oldExtensionsDir, repoPath)} activity ${info.firstAt} to ${info.lastAt}`, data: { path: repoPath, firstCommit: info.firstHash, firstSubject: info.firstSubject, lastCommit: info.lastHash, lastSubject: info.lastSubject, remote: info.remote } });
	}

	deriveLogicalThreads(store);
	store.sources.sort((a, b) => a.id.localeCompare(b.id));
	for (const key of ["sessions", "sessionObservations", "edges", "labels", "aliases", "classifications", "evidence", "backupObservations", "repositories", "artifacts", "observationMarks", "batchOperations", "logicalThreads", "threadMembers", "threadEdges"] as const) store[key].sort((a, b) => a.id.localeCompare(b.id));
	await mkdir(storeDir, { recursive: true });
	await mkdir(graphDir, { recursive: true });
	const out = JSON.stringify(store, null, 2) + "\n";
	await writeFile(join(storeDir, "session-store.export.json"), out);
	await writeFile(join(graphDir, "curated-store.json"), out);
	replaceSqlite(sqlitePath, store);
	console.log(`Wrote ${store.sessions.length} sessions, ${store.edges.length} edges, ${store.evidence.length} evidence records to ${join(storeDir, "session-store.export.json")}`);
	console.log(`Wrote SQLite store to ${sqlitePath}`);
}

await main();
