#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { execFile } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const debugBuild = Boolean(process.env.AGENT_SESSION_STORE_DEBUG);
function debug(message: string) { if (debugBuild) console.error(`[build-store] ${message}`); }

const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const graphDir = join(agentDir, "session-graph");
const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(agentDir, "session-store");
const sessionsDir = join(agentDir, "sessions");
const legacyManifestPath = join(agentDir, "relocations.jsonl");
const sessionMoveManifestPath = join(agentDir, "session-move", "manifests", "relocations.jsonl");
const manifestPaths = [legacyManifestPath, sessionMoveManifestPath];
const legacyLineageNamesPath = join(agentDir, "relocation-lineages.jsonl");
const sessionMoveLineageNamesPath = join(agentDir, "session-move", "manifests", "relocation-lineages.jsonl");
const lineageNamePaths = [legacyLineageNamesPath, sessionMoveLineageNamesPath];
const overlaysPath = join(graphDir, "lineage-overlays.jsonl");
const preManifestPath = join(graphDir, "pre-manifest-lineage.json");
const prefixLineagePath = join(graphDir, "prefix-lineage.json");
const inventoryPath = join(graphDir, "temporal-inventory.json");
const bucketReconciliationPath = join(storeDir, "session-bucket-reconciliation.json");
const repoIdentitySidecarPath = join(storeDir, "repo-identities.jsonl");
const observationMarksSidecarPath = join(storeDir, "observation-marks.jsonl");
const checkpointCandidatePaths = [
	join(storeDir, "store-verification.md"),
	join(storeDir, "backup-readiness.md"),
	join(storeDir, "logical-threads.md"),
	join(storeDir, "session-bucket-reconciliation.md"),
];
const oldExtensionsDir = join(home, "git", "agents", "x-pi-old-extensions");
const sqlitePath = join(storeDir, "session-store.sqlite");
const defaultCodingSessionsRoots = [
	join(home, "Downloads", "coding-sessions"),
	join(home, "Desktop", "developer-archive", "coding-sessions", "keep-session-data"),
	join(home, "Library", "Mobile Documents", "com~apple~CloudDocs", "developer", "coding-sessions-organized-20260531T052907Z", "keep-session-data"),
];
const codingSessionsRoots = (process.env.AGENT_SESSION_EXTERNAL_ROOTS?.split(":").filter(Boolean) ?? defaultCodingSessionsRoots);

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
	mode?: "move" | "branch" | "diverge";
	operationType?: string;
	tool?: string;
	sourceRepo?: string;
	targetRepo?: string;
	metadata?: Json;
	metadata_json?: string;
	batchId?: string;
	__manifestPath?: string;
};

type LineageNameRecord = { type: "lineage_named"; root: string; name: string; currentSession?: string; sessionId?: string; created?: string; updated?: string; source?: string; __lineageNamePath?: string };

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
	checkpointArtifacts: CheckpointArtifact[];
	observationMarks: ObservationMark[];
	batchOperations: BatchOperation[];
	logicalThreads: LogicalThread[];
	threadMembers: ThreadMember[];
	threadEdges: ThreadEdge[];
	threadResumeTargets: ThreadResumeTarget[];
	bucketStatuses: BucketStatus[];
	repoIdentities: RepoIdentity[];
	repoObservations: RepoObservation[];
	repoEvents: RepoEvent[];
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
type CheckpointArtifact = { id: string; threadId?: string; sessionId?: string; observationId?: string; kind: string; path?: string; generatedAt: string; generator: string; inputHash?: string; privacyStatus: string; summary?: string; metadata?: Json };
type ObservationMark = { id: string; observationId: string; markType: string; reason?: string; replacementObservationId?: string; source: string; timestamp: string; confidence: string; manualReviewRequired: boolean; metadata?: Json };
type BatchOperation = { id: string; operationType: string; sourcePath: string; destinationPath: string; timestamp: string; source: string; status: string; metadata?: Json };
type LogicalThread = { id: string; label?: string; confidence: string; source: string; metadata?: Json };
type ThreadMember = { id: string; threadId: string; sessionId: string; observationId?: string; role: string; ordinal: number; metadata?: Json };
type ThreadEdge = { id: string; threadId: string; sourceSessionId: string; targetSessionId: string; relation: string; edgeId?: string; confidence: string; source: string; metadata?: Json };
type ThreadResumeTarget = { id: string; threadId: string; status: string; recommendedSessionId?: string; recommendedObservationId?: string; activeLeafSessionIds: string[]; recoverableSessionIds: string[]; reasons: string[]; metadata?: Json };
type BucketStatus = { id: string; root: string; bucket: string; decodedPath?: string; status: string; confidence: string; sessionCount: number; earliest?: string; latest?: string; reasons: string[]; metadata?: Json };
type RepoIdentity = { id: string; stableName: string; displayName?: string; description?: string; confidence: string; source: string; metadata?: Json };
type RepoObservation = { id: string; repoIdentityId: string; path?: string; bucket?: string; remoteUrl?: string; validFrom?: string; validTo?: string; confidence: string; source: string; evidenceId?: string; metadata?: Json };
type RepoEvent = { id: string; eventType: "rename" | "move" | "swap" | "fork" | "archive" | "superseded_by" | "alias" | string; repoIdentityId?: string; relatedRepoIdentityId?: string; fromPath?: string; toPath?: string; timestamp?: string; confidence: string; source: string; evidenceId?: string; manualReviewRequired: boolean; summary?: string; metadata?: Json };
type Seen = { sources: Set<string>; sessions: Set<string>; obs: Set<string>; edges: Set<string>; labels: Set<string>; aliases: Set<string>; classes: Set<string>; evidence: Set<string>; backups: Set<string>; repos: Set<string>; artifacts: Set<string>; marks: Set<string>; batches: Set<string>; repoIdentities: Set<string>; repoObservations: Set<string>; repoEvents: Set<string> };
type RepoIdentitySidecar = { kind: "repo-identity"; id?: string; stableName: string; displayName?: string; description?: string; confidence?: string; metadata?: Json } | { kind: "repo-observation"; repoIdentityId?: string; stableName?: string; path?: string; bucket?: string; remoteUrl?: string; validFrom?: string; validTo?: string; confidence?: string; evidence?: string; metadata?: Json } | { kind: "repo-event"; eventType: string; repoIdentityId?: string; stableName?: string; relatedRepoIdentityId?: string; relatedStableName?: string; fromPath?: string; toPath?: string; timestamp?: string; confidence?: string; summary?: string; evidence?: string; manualReviewRequired?: boolean; metadata?: Json };
type ObservationMarkSidecar = { kind: "observation-mark"; markType: "preserve" | "intentional_branch" | string; path?: string; sessionId?: string; observationId?: string; label?: string; reason?: string; timestamp?: string; confidence?: string; source?: string; replacementObservationId?: string; manualReviewRequired?: boolean; metadata?: Json };

function sha(text: string) { return createHash("sha256").update(text).digest("hex"); }
function id(prefix: string, ...parts: (string | undefined)[]) { return `${prefix}_${sha(parts.filter(Boolean).join("\u0000")).slice(0, 16)}`; }
function sessionIdFromPath(path: string) { return basename(path).match(/_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:_|\.|$)/)?.[1]; }
function sessionStartTimestamp(path: string) { return basename(path).match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/)?.[1]?.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z"); }
async function exists(path: string) { try { await stat(path); return true; } catch { return false; } }
async function readJsonl<T>(path: string): Promise<T[]> { if (!(await exists(path))) return []; const raw = await readFile(path, "utf8"); return raw.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line) as T); }
async function readRelocationManifests(paths: string[]): Promise<RelocationRecord[]> {
	const seen = new Set<string>();
	const out: RelocationRecord[] = [];
	for (const path of paths) {
		for (const record of await readJsonl<RelocationRecord>(path)) {
			const key = JSON.stringify({ ...record, __manifestPath: undefined });
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({ ...record, __manifestPath: path });
		}
	}
	return out.sort((a, b) => a.ts.localeCompare(b.ts));
}
async function readLineageNames(paths: string[]): Promise<LineageNameRecord[]> {
	const seen = new Set<string>();
	const out: LineageNameRecord[] = [];
	for (const path of paths) {
		for (const record of await readJsonl<LineageNameRecord>(path)) {
			if (record.type !== "lineage_named" || !record.root || !record.name) continue;
			const key = JSON.stringify({ ...record, __lineageNamePath: undefined });
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({ ...record, __lineageNamePath: path });
		}
	}
	return out.sort((a, b) => (a.updated ?? a.created ?? "").localeCompare(b.updated ?? b.created ?? ""));
}
async function readJson<T>(path: string): Promise<T | undefined> { if (!(await exists(path))) return undefined; return JSON.parse(await readFile(path, "utf8")) as T; }
function rowTimestamp(row: Json): string | undefined { for (const key of ["timestamp", "ts", "createdAt", "created_at"]) if (typeof row[key] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(row[key])) return row[key] as string; const msg = row.message as Json | undefined; return typeof msg?.timestamp === "string" ? msg.timestamp : undefined; }
function rowCwd(row: Json): string | undefined { if (typeof row.cwd === "string") return row.cwd; const session = row.session as Json | undefined; return typeof session?.cwd === "string" ? session.cwd : undefined; }
function asObj(value: unknown): Json | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as Json : undefined; }
function str(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value : undefined; }
function num(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function isoFromMs(value: unknown): string | undefined { const n = num(value); return n ? new Date(n).toISOString() : undefined; }
function minTs(a?: string, b?: string) { if (!a) return b; if (!b) return a; return a.localeCompare(b) <= 0 ? a : b; }
function maxTs(a?: string, b?: string) { if (!a) return b; if (!b) return a; return a.localeCompare(b) >= 0 ? a : b; }
function eventType(row: Json): string { return str(row.type) ?? str(asObj(row.payload)?.type) ?? str(row.role) ?? "unknown"; }
function recordMetadata(record: { metadata?: Json; metadata_json?: string }): Json {
	if (record.metadata) return record.metadata;
	if (record.metadata_json) { try { return JSON.parse(record.metadata_json) as Json; } catch { return {}; } }
	return {};
}
function recordString(record: RelocationRecord, key: "operationType" | "tool" | "sourceRepo" | "targetRepo"): string | undefined {
	return str(record[key]) ?? str(recordMetadata(record)[key]);
}
function relocationOperationType(record: RelocationRecord): string {
	return recordString(record, "operationType") ?? (record.batchId ? "bucket_relocation" : "session_relocation");
}
function relocationTool(record: RelocationRecord): string {
	return recordString(record, "tool") ?? (record.__manifestPath === sessionMoveManifestPath ? "pi-session-move" : "pi-relocate");
}
function relocationMode(record: RelocationRecord): string {
	return record.mode ?? "move";
}
function compactionDetails(row: Json): Json | undefined {
	const message = asObj(row.message);
	const details = asObj(message?.details) ?? asObj(row.details);
	const direct = asObj(details?.rtkCompaction) ?? asObj(asObj(details?.metadata)?.rtkCompaction);
	const nested = asObj(asObj(details?.ptcValue)?.rtkCompaction);
	const compaction = direct ?? nested;
	const summary = typeof row.summary === "string" ? row.summary : undefined;
	if (compaction) return { sourceType: eventType(row), ...compaction, ...(summary ? { summaryLength: summary.length, summarySha256: sha(summary) } : {}) };
	if (eventType(row) === "compaction" && summary?.trim()) return { sourceType: "compaction", summaryRecord: true, summaryLength: summary.length, summarySha256: sha(summary) };
	return undefined;
}

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
	let compactionEventCount = 0;
	let summaryEventCount = 0;
	let compactedLineCount = 0;
	let compactedCharCount = 0;
	let firstCompactionAt: string | undefined;
	let lastCompactionAt: string | undefined;
	const compactionSummaryHashes = new Set<string>();
	const compactionSampleLines: number[] = [];
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
				const compaction = compactionDetails(row);
				if (compaction) {
					compactionEventCount++;
					if (compaction.summaryRecord) summaryEventCount++;
					compactedLineCount += num(compaction.compactedLineCount) ?? 0;
					compactedCharCount += num(compaction.compactedCharCount) ?? 0;
					if (ts) { firstCompactionAt = minTs(firstCompactionAt, ts); lastCompactionAt = maxTs(lastCompactionAt, ts); }
					if (typeof compaction.summarySha256 === "string") compactionSummaryHashes.add(compaction.summarySha256);
					if (compactionSampleLines.length < 5) compactionSampleLines.push(lineCount);
				}
			} catch { /* metadata-only scan tolerates malformed rows */ }
		}
	}
	const compactionMetadata = compactionEventCount ? { eventCount: compactionEventCount, summaryEventCount, compactedLineCount, compactedCharCount, firstCompactionAt, lastCompactionAt, summaryHashes: [...compactionSummaryHashes].sort(), sampleLines: compactionSampleLines, provenance: "pi-session-jsonl", privacyStatus: "metadata-only" } : undefined;
	return {
		session: { id: sessionId, provider: "pi", providerSessionId, canonicalKey: path, firstSeenAt: firstEventAt ?? sessionStartTimestamp(path), lastSeenAt: lastEventAt, startTimestamp: sessionStartTimestamp(path), endTimestamp: lastEventAt, lineCount, byteCount: fileSize, contentSha256, metadata: { ...(cwd ? { cwd } : {}), ...(displayName ? { displayName } : {}), ...(compactionMetadata ? { compaction: compactionMetadata } : {}) } },
		observation: { id: id("obs", sourceId, path), sessionId, sourceId, path, providerSessionId, fileBirthtime, fileMtime, fileSize, lineCount, firstEventAt, lastEventAt, contentSha256, metadata: { ...(cwd ? { cwd } : {}), ...(displayName ? { displayName } : {}), ...(compactionMetadata ? { compaction: compactionMetadata } : {}) } },
	};
}

async function fileStats(path: string) {
	const [raw, st] = await Promise.all([readFile(path, "utf8"), stat(path)]);
	return { raw, fileSize: st.size, fileBirthtime: st.birthtime.toISOString(), fileMtime: st.mtime.toISOString(), contentSha256: sha(raw), lineCount: raw.split("\n").filter((line) => line.trim()).length };
}

function externalSession(path: string, sourceId: string, provider: string, providerSessionId: string, meta: { cwd?: string; title?: string; start?: string; end?: string; lineCount?: number; byteCount?: number; contentSha256?: string; fileBirthtime?: string; fileMtime?: string; eventCounts?: Record<string, number>; extra?: Json }): { session: Session; observation: SessionObservation } {
	const sid = id("session", provider, providerSessionId, path);
	const metadata = { ...(meta.cwd ? { cwd: meta.cwd } : {}), ...(meta.title ? { displayName: meta.title } : {}), ...(meta.eventCounts ? { eventCounts: meta.eventCounts } : {}), ...(meta.extra ?? {}) };
	return {
		session: { id: sid, provider, providerSessionId, canonicalKey: path, firstSeenAt: meta.start, lastSeenAt: meta.end, startTimestamp: meta.start, endTimestamp: meta.end, lineCount: meta.lineCount, byteCount: meta.byteCount, contentSha256: meta.contentSha256, metadata },
		observation: { id: id("obs", sourceId, path), sessionId: sid, sourceId, path, providerSessionId, observedAt: new Date().toISOString(), snapshotLabel: "external-import", fileBirthtime: meta.fileBirthtime, fileMtime: meta.fileMtime, fileSize: meta.byteCount, lineCount: meta.lineCount, firstEventAt: meta.start, lastEventAt: meta.end, contentSha256: meta.contentSha256, metadata },
	};
}

async function walkFiles(root: string, predicate: (path: string) => boolean): Promise<string[]> {
	const found: string[] = [];
	async function walk(dir: string) {
		const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
		for (const entry of entries) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) await walk(path);
			else if (entry.isFile() && predicate(path)) found.push(path);
		}
	}
	if (await exists(root)) await walk(root);
	return found.sort();
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

async function addExternalProviderSessions(store: Store, seen: { sources: Set<string>; sessions: Set<string>; obs: Set<string>; labels: Set<string>; artifacts: Set<string> }, addSource: (provider: string, kind: string, uri: string, label?: string, metadata?: Json) => string) {
	function addParsed(provider: string, sourceId: string, path: string, providerSessionId: string, meta: Parameters<typeof externalSession>[4]) {
		const { session, observation } = externalSession(path, sourceId, provider, providerSessionId, meta);
		pushUnique(store.sessions, seen.sessions, session);
		pushUnique(store.sessionObservations, seen.obs, observation);
		if (meta.title) pushUnique(store.labels, seen.labels, { id: id("label", provider, session.id, "display", meta.title), targetType: "session", targetId: session.id, labelType: "display_name", value: meta.title, confidence: "observed", sourceId });
		if (meta.cwd) pushUnique(store.labels, seen.labels, { id: id("label", provider, session.id, "cwd", meta.cwd), targetType: "session", targetId: session.id, labelType: "cwd", value: meta.cwd, confidence: "observed", sourceId });
	}
	for (const root of codingSessionsRoots) {
		const base = root;
		// Codex JSONL sessions.
		const codexRoot = join(base, "codex", "sessions");
		const codexSource = addSource("codex", "session_archive", codexRoot, "Codex sessions");
		for (const path of await walkFiles(codexRoot, (p) => p.endsWith(".jsonl"))) {
			const fs = await fileStats(path).catch(() => undefined); if (!fs) continue;
			let sid = basename(path).match(/(019[0-9a-f-]{32,})/)?.[1] ?? basename(path).replace(/\.jsonl$/, "");
			let cwd: string | undefined; let title: string | undefined; let start: string | undefined; let end: string | undefined; const counts: Record<string, number> = {};
			for (const line of fs.raw.split("\n")) { if (!line.trim()) continue; try { const row = JSON.parse(line) as Json; counts[eventType(row)] = (counts[eventType(row)] ?? 0) + 1; const ts = rowTimestamp(row) ?? str(asObj(row.payload)?.timestamp); start = minTs(start, ts); end = maxTs(end, ts); const payload = asObj(row.payload); cwd ??= str(payload?.cwd) ?? str(asObj(payload?.turn_context)?.cwd); title ??= str(payload?.title); sid = str(payload?.id) ?? sid; } catch {} }
			addParsed("codex", codexSource, path, sid, { cwd, title, start, end, lineCount: fs.lineCount, byteCount: fs.fileSize, contentSha256: fs.contentSha256, fileBirthtime: fs.fileBirthtime, fileMtime: fs.fileMtime, eventCounts: counts });
		}
		// oh-my-pi JSONL sessions.
		const ompRoot = join(base, "omp", "agent", "sessions");
		const ompSource = addSource("oh-my-pi", "session_archive", ompRoot, "oh-my-pi sessions");
		for (const path of await walkFiles(ompRoot, (p) => p.endsWith(".jsonl"))) {
			const fs = await fileStats(path).catch(() => undefined); if (!fs) continue;
			let sid = basename(path).match(/_([0-9a-f]{16})\.jsonl$/)?.[1] ?? basename(path).replace(/\.jsonl$/, "");
			let cwd: string | undefined; let title: string | undefined; let start: string | undefined; let end: string | undefined; const counts: Record<string, number> = {};
			for (const line of fs.raw.split("\n")) { if (!line.trim()) continue; try { const row = JSON.parse(line) as Json; counts[eventType(row)] = (counts[eventType(row)] ?? 0) + 1; const ts = rowTimestamp(row); start = minTs(start, ts); end = maxTs(end, ts); if (row.type === "session") { sid = str(row.id) ?? sid; cwd ??= str(row.cwd); title ??= str(row.title); } } catch {} }
			addParsed("oh-my-pi", ompSource, path, sid, { cwd, title, start, end, lineCount: fs.lineCount, byteCount: fs.fileSize, contentSha256: fs.contentSha256, fileBirthtime: fs.fileBirthtime, fileMtime: fs.fileMtime, eventCounts: counts });
		}
		// Factory JSONL sessions.
		const factoryRoot = join(base, "factory", "sessions");
		const factorySource = addSource("factory", "session_archive", factoryRoot, "Factory sessions");
		for (const path of await walkFiles(factoryRoot, (p) => p.endsWith(".jsonl"))) {
			const fs = await fileStats(path).catch(() => undefined); if (!fs) continue;
			let sid = basename(path).replace(/\.jsonl$/, ""); let cwd: string | undefined; let title: string | undefined; let start: string | undefined; let end: string | undefined; const counts: Record<string, number> = {};
			for (const line of fs.raw.split("\n")) { if (!line.trim()) continue; try { const row = JSON.parse(line) as Json; counts[eventType(row)] = (counts[eventType(row)] ?? 0) + 1; const ts = rowTimestamp(row); start = minTs(start, ts); end = maxTs(end, ts); if (row.type === "session_start") { sid = str(row.id) ?? sid; cwd ??= str(row.cwd); title ??= str(row.sessionTitle) ?? str(row.title); } } catch {} }
			addParsed("factory", factorySource, path, sid, { cwd, title, start, end, lineCount: fs.lineCount, byteCount: fs.fileSize, contentSha256: fs.contentSha256, fileBirthtime: fs.fileBirthtime, fileMtime: fs.fileMtime, eventCounts: counts, extra: { trivial: Object.keys(counts).length === 1 && counts.session_start === 1 } });
		}
		// Claude transcripts.
		const claudeRoot = join(base, "claude");
		const claudeSource = addSource("claude", "session_archive", claudeRoot, "Claude sessions");
		for (const path of await walkFiles(join(claudeRoot, "transcripts"), (p) => p.endsWith(".jsonl"))) {
			const fs = await fileStats(path).catch(() => undefined); if (!fs) continue;
			const sid = basename(path).replace(/\.jsonl$/, ""); let cwd: string | undefined; let title: string | undefined; let start: string | undefined; let end: string | undefined; const counts: Record<string, number> = {};
			for (const line of fs.raw.split("\n")) { if (!line.trim()) continue; try { const row = JSON.parse(line) as Json; counts[eventType(row)] = (counts[eventType(row)] ?? 0) + 1; const ts = rowTimestamp(row); start = minTs(start, ts); end = maxTs(end, ts); cwd ??= rowCwd(row) ?? str(asObj(row.tool_input)?.path); title ??= str(row.summary); } catch {} }
			addParsed("claude", claudeSource, path, sid, { cwd, title, start, end, lineCount: fs.lineCount, byteCount: fs.fileSize, contentSha256: fs.contentSha256, fileBirthtime: fs.fileBirthtime, fileMtime: fs.fileMtime, eventCounts: counts });
		}
		// Rovo Dev sessions.
		const rovoRoot = join(base, "rovodev", "sessions");
		const rovoSource = addSource("rovodev", "session_archive", rovoRoot, "Rovo Dev sessions");
		for (const path of await walkFiles(rovoRoot, (p) => p.endsWith("session_context.json"))) {
			const fs = await fileStats(path).catch(() => undefined); if (!fs) continue;
			const obj = JSON.parse(fs.raw) as Json; const artifacts = asObj(asObj(obj.deps)?.artifacts); const meta = asObj(artifacts?.["metadata.json"]); const messages = Array.isArray(obj.message_history) ? obj.message_history as Json[] : [];
			addParsed("rovodev", rovoSource, path, str(obj.id) ?? basename(dirname(path)), { cwd: str(meta?.workspace_path), title: str(meta?.title), lineCount: fs.lineCount, byteCount: fs.fileSize, contentSha256: fs.contentSha256, fileBirthtime: fs.fileBirthtime, fileMtime: fs.fileMtime, eventCounts: { message: messages.length }, extra: { messageCount: messages.length } });
		}
		// Late sessions.
		const lateRoot = join(base, "late", "sessions");
		const lateSource = addSource("late", "session_archive", lateRoot, "Late sessions");
		for (const path of await walkFiles(lateRoot, (p) => /^session-.*\.json$/.test(basename(p)) && !p.endsWith(".meta.json"))) {
			const fs = await fileStats(path).catch(() => undefined); if (!fs) continue;
			const rows = JSON.parse(fs.raw) as Json[]; const meta = await readJson<Json>(path.replace(/\.json$/, ".meta.json")); const counts: Record<string, number> = {};
			for (const row of Array.isArray(rows) ? rows : []) counts[str(row.role) ?? "unknown"] = (counts[str(row.role) ?? "unknown"] ?? 0) + 1;
			addParsed("late", lateSource, path, str(meta?.id) ?? basename(path).replace(/\.json$/, ""), { title: str(meta?.title), start: str(meta?.created_at), end: str(meta?.last_updated), lineCount: fs.lineCount, byteCount: fs.fileSize, contentSha256: fs.contentSha256, fileBirthtime: fs.fileBirthtime, fileMtime: fs.fileMtime, eventCounts: counts, extra: { messageCount: num(meta?.message_count), trivial: (num(meta?.message_count) ?? 0) <= 3 } });
		}
		// OpenCode multi-file sessions.
		const ocRoot = join(base, "opencode-sessions", "storage");
		const ocSource = addSource("opencode", "session_archive", ocRoot, "OpenCode sessions");
		for (const path of await walkFiles(join(ocRoot, "session"), (p) => p.endsWith(".json") && basename(p) !== ".DS_Store")) {
			const fs = await fileStats(path).catch(() => undefined); if (!fs) continue;
			const obj = JSON.parse(fs.raw) as Json; const time = asObj(obj.time); const sid = str(obj.id) ?? basename(path).replace(/\.json$/, "");
			const messages = await walkFiles(join(ocRoot, "message", sid), (p) => p.endsWith(".json")).catch(() => []);
			addParsed("opencode", ocSource, path, sid, { cwd: str(obj.directory), title: str(obj.title) ?? str(obj.slug), start: isoFromMs(time?.created), end: isoFromMs(time?.updated), lineCount: fs.lineCount, byteCount: fs.fileSize, contentSha256: fs.contentSha256, fileBirthtime: fs.fileBirthtime, fileMtime: fs.fileMtime, eventCounts: { message: messages.length }, extra: { projectId: str(obj.projectID), slug: str(obj.slug), messageCount: messages.length } });
		}
		// Manual exports as artifacts, not sessions.
		const manualRoots = [join(base, "codex", "manual-markdown-exports"), join(base, "omp", "manual-markdown-exports"), join(base, "omp", "html-session-exports")];
		const manualSource = addSource("manual-curation", "manual_session_exports", base, "Manual session exports");
		for (const root of manualRoots) for (const path of await walkFiles(root, (p) => /\.(md|html)$/i.test(p))) {
			const fs = await fileStats(path).catch(() => undefined); if (!fs) continue;
			const ids = [...new Set(fs.raw.match(/019[0-9a-f-]{32,}|[0-9a-f]{16}/g) ?? [])];
			pushUnique(store.artifacts, seen.artifacts, { id: id("artifact", "manual-export", path), kind: ids.length > 1 ? "manual_session_bundle" : "manual_session_export", path, generatedAt: new Date().toISOString(), generator: "manual-export", inputHash: fs.contentSha256, metadata: { sourceId: manualSource, matchedProviderSessionIds: ids, byteCount: fs.fileSize, lineCount: fs.lineCount } });
		}
	}
}

function sessionTime(session: Session): string { return session.startTimestamp ?? session.firstSeenAt ?? session.endTimestamp ?? session.lastSeenAt ?? ""; }

function deriveCrossProviderContinuity(store: Store, seen: Seen) {
	const byCwd = new Map<string, Session[]>();
	for (const session of store.sessions) {
		const cwd = typeof session.metadata?.cwd === "string" ? session.metadata.cwd : undefined;
		if (!cwd || session.metadata?.trivial || session.metadata?.testSession) continue;
		const group = byCwd.get(cwd) ?? [];
		group.push(session);
		byCwd.set(cwd, group);
	}
	for (const [cwd, group] of byCwd) {
		const providers = new Set(group.map((session) => session.provider));
		if (providers.size < 2) continue;
		group.sort((a, b) => sessionTime(a).localeCompare(sessionTime(b)) || a.id.localeCompare(b.id));
		for (let i = 1; i < group.length; i++) {
			const source = group[i - 1]!;
			const target = group[i]!;
			if (source.provider === target.provider) continue;
			const edgeId = id("edge", "cross-provider-cwd", source.id, target.id);
			pushUnique(store.edges, seen.edges, { id: edgeId, sourceSessionId: source.id, targetSessionId: target.id, edgeType: "same_cwd_temporal", timestamp: target.startTimestamp ?? target.firstSeenAt, confidence: "low", provenance: "derived-cross-provider-cwd-time", metadata: { cwd, sourceProvider: source.provider, targetProvider: target.provider, reason: "same-cwd-consecutive-cross-provider-session" } });
		}
	}
}

function words(value: unknown): string[] {
	if (typeof value !== "string") return [];
	return [...new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((w) => w.length > 3 && !["session", "work", "test", "with", "from", "that", "this", "have", "your"].includes(w)))].slice(0, 8);
}

function deriveAdditionalMetadata(store: Store, seen: Seen, generatedAt: string) {
	const confidenceRank = (confidence: string) => ({ manual: 4, authoritative: 3, observed: 2, high: 2, medium: 1, low: 0 }[confidence] ?? 0);
	const repoByPath = [...store.repoObservations].filter((obs) => obs.path).sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0) || confidenceRank(b.confidence) - confidenceRank(a.confidence));
	const repoFor = (cwd?: string) => cwd ? repoByPath.find((obs) => obs.path && (cwd === obs.path || cwd.startsWith(`${obs.path}/`))) : undefined;
	const byRepo = new Map<string, Session[]>();
	for (const session of store.sessions) {
		const metadata = session.metadata ??= {};
		const cwd = typeof metadata.cwd === "string" ? metadata.cwd : undefined;
		const repo = repoFor(cwd);
		if (repo) { metadata.repoIdentityId = repo.repoIdentityId; const list = byRepo.get(repo.repoIdentityId) ?? []; list.push(session); byRepo.set(repo.repoIdentityId, list); }
		const eventCounts = asObj(metadata.eventCounts) ?? {};
		const toolCounts = Object.fromEntries(Object.entries(eventCounts).filter(([k]) => /tool|command|exec|edit|write|read|patch/i.test(k)));
		if (Object.keys(toolCounts).length) metadata.activitySummary = { toolCounts, eventCounts };
		const kws = words(metadata.displayName);
		if (kws.length) pushUnique(store.labels, seen.labels, { id: id("label", "keywords", session.id, kws.join("-")), targetType: "session", targetId: session.id, labelType: "keywords", value: kws.join(", "), confidence: "derived", sourceId: undefined, metadata: { source: "title-only" } });
		const observation = store.sessionObservations.find((obs) => obs.sessionId === session.id);
		if (observation && (/\.Trash\//.test(observation.path) || /trash|restored|recovered/i.test(JSON.stringify(observation.metadata ?? {})))) pushUnique(store.observationMarks, seen.marks, { id: id("mark", "restored", observation.id), observationId: observation.id, markType: "restored_or_recovered", reason: "path-or-metadata-indicates-restored-session", source: "derived-restored-provenance", timestamp: generatedAt, confidence: "low", manualReviewRequired: true });
	}
	for (const [repoIdentityId, group] of byRepo) {
		const providers = new Set(group.map((s) => s.provider));
		if (providers.size < 2) continue;
		group.sort((a, b) => sessionTime(a).localeCompare(sessionTime(b)) || a.id.localeCompare(b.id));
		for (let i = 1; i < group.length; i++) {
			const source = group[i - 1]!; const target = group[i]!;
			if (source.provider === target.provider) continue;
			pushUnique(store.edges, seen.edges, { id: id("edge", "repo-identity", repoIdentityId, source.id, target.id), sourceSessionId: source.id, targetSessionId: target.id, edgeType: "same_repo_identity_temporal", timestamp: target.startTimestamp ?? target.firstSeenAt, confidence: "medium", provenance: "derived-repo-identity-time", metadata: { repoIdentityId, sourceProvider: source.provider, targetProvider: target.provider } });
		}
		for (let i = 0; i < group.length; i += 12) {
			const burst = group.slice(i, i + 12); const start = burst[0]; const end = burst[burst.length - 1];
			pushUnique(store.artifacts, seen.artifacts, { id: id("artifact", "work-burst", repoIdentityId, start?.id, end?.id), kind: "temporal_work_burst", path: `derived:${repoIdentityId}:${i}`, generatedAt, generator: "scripts/build-curated-store.ts", metadata: { repoIdentityId, sessionIds: burst.map((s) => s.id), providers: [...new Set(burst.map((s) => s.provider))], start: start?.startTimestamp ?? start?.firstSeenAt, end: end?.endTimestamp ?? end?.lastSeenAt, sessionCount: burst.length } });
		}
	}
	for (const artifact of store.artifacts.filter((a) => a.kind.startsWith("manual_session_"))) {
		const ids = Array.isArray(artifact.metadata?.matchedProviderSessionIds) ? artifact.metadata.matchedProviderSessionIds : [];
		for (const providerSessionId of ids) for (const session of store.sessions.filter((s) => s.providerSessionId === providerSessionId)) pushUnique(store.evidence, seen.evidence, { id: id("evidence", "manual-export-link", artifact.id, session.id), kind: "manual_export_session_link", targetType: "session", targetId: session.id, confidence: "high", summary: `Manual export ${basename(artifact.path)} links to ${session.provider}:${providerSessionId}`, data: { artifactId: artifact.id, artifactPath: artifact.path, providerSessionId } });
	}
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
	const childCounts = new Map<string, number>();
	for (const edge of store.edges) childCounts.set(edge.sourceSessionId, (childCounts.get(edge.sourceSessionId) ?? 0) + 1);
	for (const edge of store.edges) {
		const threadId = threadBySession.get(edge.sourceSessionId);
		if (!threadId || threadBySession.get(edge.targetSessionId) !== threadId) continue;
		const edgeClassifications = store.classifications.filter((item) => item.targetType === "edge" && item.targetId === edge.id).map((item) => item.classification);
		let relation: string;
		const reasons: string[] = [];
		if (edgeClassifications.some((classification) => classification.includes("context"))) { relation = "context_jump"; reasons.push("curated-context-classification"); }
		else if (edge.edgeType === "branch" || edge.metadata?.mode === "branch") { relation = "fork"; reasons.push("explicit-branch-mode"); }
		else if ((childCounts.get(edge.sourceSessionId) ?? 0) > 1) { relation = "fork"; reasons.push("multiple-children-from-source"); }
		else if ((edge.provenance === "pi-relocate-manifest" || edge.provenance === "pi-session-move-manifest") && edge.confidence === "authoritative") { relation = "continuation"; reasons.push("authoritative-manifest-move"); }
		else if (edgeClassifications.some((classification) => classification.includes("continuation"))) { relation = "continuation"; reasons.push("curated-continuation-classification"); }
		else { relation = "unknown"; reasons.push("insufficient-deterministic-evidence"); }
		store.threadEdges.push({ id: id("thread_edge", threadId, edge.id), threadId, sourceSessionId: edge.sourceSessionId, targetSessionId: edge.targetSessionId, relation, edgeId: edge.id, confidence: edge.confidence, source: edge.provenance, metadata: { classifications: edgeClassifications, edgeType: edge.edgeType, reasons } });
	}
}

function deriveResumeTargets(store: Store) {
	const membersByThread = new Map<string, ThreadMember[]>();
	for (const member of store.threadMembers) membersByThread.set(member.threadId, [...(membersByThread.get(member.threadId) ?? []), member]);
	const outgoing = new Map<string, ThreadEdge[]>();
	for (const edge of store.threadEdges) {
		if (edge.relation === "context_jump") continue;
		outgoing.set(edge.sourceSessionId, [...(outgoing.get(edge.sourceSessionId) ?? []), edge]);
	}
	const marksByObservation = new Map<string, ObservationMark[]>();
	for (const mark of store.observationMarks) marksByObservation.set(mark.observationId, [...(marksByObservation.get(mark.observationId) ?? []), mark]);
	const latest = (ids: string[]) => [...ids].sort((a, b) => {
		const sa = store.sessions.find((session) => session.id === a);
		const sb = store.sessions.find((session) => session.id === b);
		return (sa?.lastSeenAt ?? sa?.startTimestamp ?? "").localeCompare(sb?.lastSeenAt ?? sb?.startTimestamp ?? "");
	}).at(-1);
	for (const thread of store.logicalThreads) {
		const members = membersByThread.get(thread.id) ?? [];
		const leaves = members.filter((member) => !outgoing.has(member.sessionId));
		const isPreserved = (member: ThreadMember) => Boolean(member.observationId && (marksByObservation.get(member.observationId) ?? []).some((mark) => mark.markType === "preserve" || mark.markType === "intentional_branch"));
		const isDeletionMarked = (member: ThreadMember) => Boolean(member.observationId && (marksByObservation.get(member.observationId) ?? []).some((mark) => mark.markType === "superseded" || mark.markType === "deletion_candidate"));
		const activeLeaves = leaves.filter((member) => isPreserved(member) || !isDeletionMarked(member));
		const recoverable = leaves.filter((member) => !isPreserved(member) && isDeletionMarked(member));
		const activeLeafSessionIds = activeLeaves.map((member) => member.sessionId);
		const recoverableSessionIds = recoverable.map((member) => member.sessionId);
		let status: string;
		const reasons: string[] = [];
		let recommendedSessionId: string | undefined;
		if (activeLeafSessionIds.length === 1) { status = "deterministic"; recommendedSessionId = activeLeafSessionIds[0]; reasons.push("one-active-leaf"); }
		else if (activeLeafSessionIds.length > 1) { status = "branch-choices"; recommendedSessionId = latest(activeLeafSessionIds); reasons.push("multiple-active-leaves", "latest-active-leaf-selected-as-convenience-not-authority"); }
		else if (recoverableSessionIds.length) { status = "recoverable-only"; recommendedSessionId = latest(recoverableSessionIds); reasons.push("no-active-leaves", "latest-recoverable-leaf"); }
		else { status = "no-target"; reasons.push("no-leaf-members"); }
		const recommendedObservationId = members.find((member) => member.sessionId === recommendedSessionId)?.observationId;
		store.threadResumeTargets.push({ id: id("resume", thread.id), threadId: thread.id, status, recommendedSessionId, recommendedObservationId, activeLeafSessionIds, recoverableSessionIds, reasons, metadata: { leafCount: leaves.length, preservedLeafCount: leaves.filter(isPreserved).length } });
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
CREATE TABLE IF NOT EXISTS checkpoint_artifacts (id TEXT PRIMARY KEY, thread_id TEXT, session_id TEXT, observation_id TEXT, kind TEXT NOT NULL, path TEXT, generated_at TEXT NOT NULL, generator TEXT NOT NULL, input_hash TEXT, privacy_status TEXT NOT NULL, summary TEXT, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS observation_marks (id TEXT PRIMARY KEY, observation_id TEXT NOT NULL, mark_type TEXT NOT NULL, reason TEXT, replacement_observation_id TEXT, source TEXT NOT NULL, timestamp TEXT NOT NULL, confidence TEXT NOT NULL, manual_review_required INTEGER NOT NULL DEFAULT 1, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS batch_operations (id TEXT PRIMARY KEY, operation_type TEXT NOT NULL, source_path TEXT NOT NULL, destination_path TEXT NOT NULL, timestamp TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS logical_threads (id TEXT PRIMARY KEY, label TEXT, confidence TEXT NOT NULL, source TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS thread_members (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, session_id TEXT NOT NULL, observation_id TEXT, role TEXT NOT NULL, ordinal INTEGER NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS thread_edges (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, source_session_id TEXT NOT NULL, target_session_id TEXT NOT NULL, relation TEXT NOT NULL, edge_id TEXT, confidence TEXT NOT NULL, source TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS thread_resume_targets (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, status TEXT NOT NULL, recommended_session_id TEXT, recommended_observation_id TEXT, active_leaf_session_ids_json TEXT NOT NULL DEFAULT '[]', recoverable_session_ids_json TEXT NOT NULL DEFAULT '[]', reasons_json TEXT NOT NULL DEFAULT '[]', metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS bucket_statuses (id TEXT PRIMARY KEY, root TEXT NOT NULL, bucket TEXT NOT NULL, decoded_path TEXT, status TEXT NOT NULL, confidence TEXT NOT NULL, session_count INTEGER NOT NULL, earliest TEXT, latest TEXT, reasons_json TEXT NOT NULL DEFAULT '[]', metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS repo_identities (id TEXT PRIMARY KEY, stable_name TEXT NOT NULL, display_name TEXT, description TEXT, confidence TEXT NOT NULL, source TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS repo_observations (id TEXT PRIMARY KEY, repo_identity_id TEXT NOT NULL, path TEXT, bucket TEXT, remote_url TEXT, valid_from TEXT, valid_to TEXT, confidence TEXT NOT NULL, source TEXT NOT NULL, evidence_id TEXT, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS repo_events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, repo_identity_id TEXT, related_repo_identity_id TEXT, from_path TEXT, to_path TEXT, timestamp TEXT, confidence TEXT NOT NULL, source TEXT NOT NULL, evidence_id TEXT, manual_review_required INTEGER NOT NULL DEFAULT 1, summary TEXT, metadata_json TEXT NOT NULL DEFAULT '{}');
`);
}

function replaceSqlite(dbPath: string, store: Store) {
	const db = new DatabaseSync(dbPath);
	try {
		db.exec("PRAGMA journal_mode = WAL");
		initSqlite(db);
		db.exec("BEGIN");
		for (const table of ["sources", "import_runs", "sessions", "session_observations", "events", "edges", "labels", "aliases", "classifications", "evidence", "backup_observations", "repositories", "artifacts", "checkpoint_artifacts", "observation_marks", "batch_operations", "logical_threads", "thread_members", "thread_edges", "thread_resume_targets", "bucket_statuses", "repo_identities", "repo_observations", "repo_events"]) db.exec(`DELETE FROM ${table}`);
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
		const checkpointStmt = db.prepare("INSERT INTO checkpoint_artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.checkpointArtifacts) checkpointStmt.run(r.id, r.threadId ?? null, r.sessionId ?? null, r.observationId ?? null, r.kind, r.path ?? null, r.generatedAt, r.generator, r.inputHash ?? null, r.privacyStatus, r.summary ?? null, json(r.metadata));
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
		const resumeStmt = db.prepare("INSERT INTO thread_resume_targets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.threadResumeTargets) resumeStmt.run(r.id, r.threadId, r.status, r.recommendedSessionId ?? null, r.recommendedObservationId ?? null, json(r.activeLeafSessionIds), json(r.recoverableSessionIds), json(r.reasons), json(r.metadata));
		const bucketStatusStmt = db.prepare("INSERT INTO bucket_statuses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.bucketStatuses) bucketStatusStmt.run(r.id, r.root, r.bucket, r.decodedPath ?? null, r.status, r.confidence, r.sessionCount, r.earliest ?? null, r.latest ?? null, json(r.reasons), json(r.metadata));
		const repoIdentityStmt = db.prepare("INSERT INTO repo_identities VALUES (?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.repoIdentities) repoIdentityStmt.run(r.id, r.stableName, r.displayName ?? null, r.description ?? null, r.confidence, r.source, json(r.metadata));
		const repoObsStmt = db.prepare("INSERT INTO repo_observations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.repoObservations) repoObsStmt.run(r.id, r.repoIdentityId, r.path ?? null, r.bucket ?? null, r.remoteUrl ?? null, r.validFrom ?? null, r.validTo ?? null, r.confidence, r.source, r.evidenceId ?? null, json(r.metadata));
		const repoEventStmt = db.prepare("INSERT INTO repo_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
		for (const r of store.repoEvents) repoEventStmt.run(r.id, r.eventType, r.repoIdentityId ?? null, r.relatedRepoIdentityId ?? null, r.fromPath ?? null, r.toPath ?? null, r.timestamp ?? null, r.confidence, r.source, r.evidenceId ?? null, r.manualReviewRequired ? 1 : 0, r.summary ?? null, json(r.metadata));
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
	const manifest = await readRelocationManifests(manifestPaths);
	const lineageNames = await readLineageNames(lineageNamePaths);
	const overlays = await readJsonl<OverlayRecord>(overlaysPath);
	const preManifest = await readJson<Json>(preManifestPath);
	const prefixLineage = await readJson<Json>(prefixLineagePath);
	const inventory = await readJson<Json>(inventoryPath);
	const bucketReconciliation = await readJson<{ buckets?: (Json & { root?: string; bucket?: string; decodedPath?: string; status?: string; confidence?: string; sessionCount?: number; earliest?: string; latest?: string; reasons?: string[] })[] }>(bucketReconciliationPath);
	const repoIdentitySidecar = await readJsonl<RepoIdentitySidecar>(repoIdentitySidecarPath);
	const observationMarkSidecar = await readJsonl<ObservationMarkSidecar>(observationMarksSidecarPath);

	const store: Store = { schemaVersion: 1, generatedAt, inputs: { agentDir, sessionsDir, manifestPaths: manifestPaths.join(":"), legacyManifestPath, sessionMoveManifestPath, lineageNamePaths: lineageNamePaths.join(":"), legacyLineageNamesPath, sessionMoveLineageNamesPath, overlaysPath, preManifestPath, prefixLineagePath, inventoryPath, bucketReconciliationPath, repoIdentitySidecarPath, observationMarksSidecarPath, oldExtensionsDir }, sources: [], importRuns: [], sessions: [], sessionObservations: [], edges: [], labels: [], aliases: [], classifications: [], evidence: [], backupObservations: [], repositories: [], artifacts: [], checkpointArtifacts: [], observationMarks: [], batchOperations: [], logicalThreads: [], threadMembers: [], threadEdges: [], threadResumeTargets: [], bucketStatuses: [], repoIdentities: [], repoObservations: [], repoEvents: [] };
	const seen = { sources: new Set<string>(), sessions: new Set<string>(), obs: new Set<string>(), edges: new Set<string>(), labels: new Set<string>(), aliases: new Set<string>(), classes: new Set<string>(), evidence: new Set<string>(), backups: new Set<string>(), repos: new Set<string>(), artifacts: new Set<string>(), marks: new Set<string>(), batches: new Set<string>(), repoIdentities: new Set<string>(), repoObservations: new Set<string>(), repoEvents: new Set<string>() };
	const addSource = (provider: string, kind: string, uri: string, label?: string, metadata?: Json) => { const source: Source = { id: id("source", provider, kind, uri), provider, kind, uri, label, metadata }; pushUnique(store.sources, seen.sources, source); return source.id; };
	const liveSource = addSource("pi", "live_sessions", sessionsDir, "Pi live sessions");
	const manifestSources = new Map(manifestPaths.map((path) => [path, addSource("pi", "relocation_manifest", path, path === sessionMoveManifestPath ? "Pi session-move manifest" : "Pi legacy relocation manifest")]));
	const lineageNameSources = new Map(lineageNamePaths.map((path) => [path, addSource("pi", "lineage_name_sidecar", path, path === sessionMoveLineageNamesPath ? "Pi session-move lineage names" : "Pi legacy lineage names")]));
	const manifestSource = manifestSources.get(legacyManifestPath)!;
	const overlaySource = addSource("manual-curation", "manual_overlay", overlaysPath, "Lineage overlays");
	const preSource = addSource("manual-curation", "curated_report", preManifestPath, "Pre-manifest lineage report");
	const prefixSource = addSource("manual-curation", "curated_report", prefixLineagePath, "Prefix lineage report");
	const oldRepoSource = addSource("git-repository", "repository_collection", oldExtensionsDir, "Old extension repositories");
	const bucketReconciliationSource = addSource("manual-curation", "bucket_reconciliation", bucketReconciliationPath, "Session bucket reconciliation");
	const repoIdentitySource = addSource("manual-curation", "repo_identity_sidecar", repoIdentitySidecarPath, "Repo identity sidecar");
	const observationMarkSource = addSource("manual-curation", "observation_mark_sidecar", observationMarksSidecarPath, "Observation mark sidecar");
	store.importRuns.push({ id: id("run", generatedAt, "build-curated-store"), sourceId: liveSource, startedAt: generatedAt, finishedAt: generatedAt, tool: "scripts/build-curated-store.ts", status: "ok", stats: { manifestRecords: manifest.length, overlayRecords: overlays.length } });

	debug("collecting live session paths");
	const paths = new Set<string>(await listSessionFiles());
	for (const record of manifest) { paths.add(record.sourceSession); paths.add(record.destinationSession); }
	for (const record of lineageNames) { paths.add(record.root); if (record.currentSession) paths.add(record.currentSession); }
	for (const record of overlays) {
		if (record.kind === "root") paths.add(record.session);
		if (record.kind === "edge") { paths.add(record.source); paths.add(record.destination); }
		if (record.kind === "session-label" && record.session) paths.add(record.session);
	}
	const obsByPath = new Map<string, SessionObservation>();
	const sessionByPath = new Map<string, Session>();
	debug(`importing ${paths.size} pi session paths`);
	for (const path of [...paths].sort()) {
		const source = path.includes("/Downloads/session-backups/") ? addSource("backup-snapshot", "backup_snapshot", path.split("/Macintosh HD/")[0], basename(path.split("/Macintosh HD/")[0])) : liveSource;
		const { session, observation } = await sessionObservation(path, source);
		pushUnique(store.sessions, seen.sessions, session);
		pushUnique(store.sessionObservations, seen.obs, observation);
		if (typeof session.metadata?.displayName === "string") pushUnique(store.labels, seen.labels, { id: id("label", "display", session.id, session.metadata.displayName), targetType: "session", targetId: session.id, labelType: "display_name", value: session.metadata.displayName, confidence: "authoritative", sourceId: source });
		const compaction = asObj(observation.metadata?.compaction);
		if (compaction) {
			pushUnique(store.evidence, seen.evidence, { id: id("evidence", "compaction", observation.id), kind: "compaction_summary", sourceId: source, targetType: "session", targetId: session.id, timestamp: str(compaction.lastCompactionAt) ?? observation.lastEventAt, confidence: "authoritative", summary: `Pi compaction metadata observed in ${basename(path)}`, data: { observationId: observation.id, path, ...compaction } });
			store.checkpointArtifacts.push({ id: id("checkpoint", "compaction", observation.id), sessionId: session.id, observationId: observation.id, kind: "compaction_summary", path, generatedAt: str(compaction.lastCompactionAt) ?? generatedAt, generator: "scripts/build-curated-store.ts", inputHash: observation.contentSha256, privacyStatus: "metadata-only", summary: `Pi compaction metadata: ${compaction.eventCount ?? "?"} events`, metadata: compaction });
		}
		obsByPath.set(path, observation);
		sessionByPath.set(path, session);
	}

	debug("importing pinned lineage names");
	for (const record of lineageNames) {
		const sourceId = lineageNameSources.get(record.__lineageNamePath ?? sessionMoveLineageNamesPath);
		const targets = [sessionByPath.get(record.root), record.currentSession ? sessionByPath.get(record.currentSession) : undefined].filter((session): session is Session => Boolean(session));
		for (const session of targets) {
			pushUnique(store.labels, seen.labels, { id: id("label", "pinned-lineage", session.id, record.name, record.updated ?? record.created), targetType: "session", targetId: session.id, labelType: "pinned_lineage_name", value: record.name, confidence: "authoritative", sourceId, metadata: { root: record.root, currentSession: record.currentSession, sessionId: record.sessionId, created: record.created, updated: record.updated, source: record.source, sidecarPath: record.__lineageNamePath } });
		}
		if (!targets.length) pushUnique(store.evidence, seen.evidence, { id: id("evidence", "unmatched-lineage-name", record.root, record.currentSession, record.name), kind: "lineage_name_unmatched", sourceId, timestamp: record.updated ?? record.created ?? generatedAt, confidence: "low", summary: `Pinned lineage name did not match imported sessions: ${record.name}`, data: { ...record } });
	}

	debug("deriving relocation manifest edges");
	for (const record of observationMarkSidecar) {
		const observation = record.observationId ? store.sessionObservations.find((obs) => obs.id === record.observationId) : record.path ? obsByPath.get(record.path) : record.sessionId ? store.sessionObservations.find((obs) => obs.sessionId === record.sessionId || obs.providerSessionId === record.sessionId) : undefined;
		if (!observation) {
			pushUnique(store.evidence, seen.evidence, { id: id("evidence", "observation-mark-unmatched", record.path, record.sessionId, record.observationId, record.markType), kind: "observation_mark_unmatched", sourceId: observationMarkSource, timestamp: record.timestamp ?? generatedAt, confidence: record.confidence ?? "low", summary: `Unmatched observation mark: ${record.markType}`, data: { ...record } });
			continue;
		}
		const markType = record.markType === "intentional_branch" ? "preserve" : record.markType;
		pushUnique(store.observationMarks, seen.marks, { id: id("mark", "sidecar", observation.id, markType, record.label, record.timestamp), observationId: observation.id, markType, reason: record.reason ?? record.label, replacementObservationId: record.replacementObservationId, source: record.source ?? "observation-marks.jsonl", timestamp: record.timestamp ?? generatedAt, confidence: record.confidence ?? "manual", manualReviewRequired: record.manualReviewRequired ?? false, metadata: { label: record.label, sidecarMarkType: record.markType, ...record.metadata } });
		if (record.label) pushUnique(store.labels, seen.labels, { id: id("label", "observation-mark", observation.sessionId, record.label), targetType: "session", targetId: observation.sessionId, labelType: markType === "preserve" ? "preserved_branch" : markType, value: record.label, confidence: record.confidence ?? "manual", sourceId: observationMarkSource, metadata: { observationId: observation.id, reason: record.reason } });
	}
	if (observationMarkSidecar.length) pushUnique(store.artifacts, seen.artifacts, { id: id("artifact", observationMarksSidecarPath), kind: "observation_mark_sidecar", path: observationMarksSidecarPath, generatedAt, generator: "manual-curated-sidecar", metadata: { imported: true, recordCount: observationMarkSidecar.length } });

	manifest.forEach((record, index) => {
		const source = sessionByPath.get(record.sourceSession);
		const target = sessionByPath.get(record.destinationSession);
		if (!source || !target) return;
		const operationType = relocationOperationType(record);
		const tool = relocationTool(record);
		const mode = relocationMode(record);
		const sourceRepo = recordString(record, "sourceRepo");
		const targetRepo = recordString(record, "targetRepo");
		const manifestRecordSource = manifestSources.get(record.__manifestPath ?? legacyManifestPath) ?? manifestSource;
		const edgeId = id("edge", "manifest", String(index), record.ts, record.sourceSession, record.destinationSession);
		const sourceObservationId = obsByPath.get(record.sourceSession)?.id;
		const targetObservationId = obsByPath.get(record.destinationSession)?.id;
		const edgeType = operationType === "repo_move" ? "repo_move" : mode === "branch" || mode === "diverge" ? "branch" : "relocation";
		const manifestMetadata = { manifestIndex: index, manifestPath: record.__manifestPath, fromCwd: record.fromCwd, toCwd: record.toCwd, replacements: record.replacements, parent: record.parent, sourceSessionId: record.sourceSessionId, destinationSessionId: record.destinationSessionId, mode, operationType, tool, sourceRepo, targetRepo, batchId: record.batchId };
		pushUnique(store.edges, seen.edges, { id: edgeId, sourceSessionId: source.id, targetSessionId: target.id, edgeType, timestamp: record.ts, sourceObservationId, targetObservationId, confidence: record.inferred ? (record.confidence ?? "medium") : "authoritative", provenance: `${tool}-manifest`, metadata: manifestMetadata });
		if (record.batchId) pushUnique(store.batchOperations, seen.batches, { id: record.batchId, operationType, sourcePath: record.fromCwd, destinationPath: record.toCwd, timestamp: record.ts, source: tool, status: "applied", metadata: { mode, operationType, tool, sourceRepo, targetRepo } });
		if (operationType === "repo_move") {
			pushUnique(store.repoEvents, seen.repoEvents, { id: id("repo_event", operationType, record.ts, sourceRepo ?? record.fromCwd, targetRepo ?? record.toCwd, record.sourceSession, record.destinationSession), eventType: "move", fromPath: sourceRepo ?? record.fromCwd, toPath: targetRepo ?? record.toCwd, timestamp: record.ts, confidence: record.inferred ? (record.confidence ?? "medium") : "authoritative", source: tool, manualReviewRequired: false, summary: `Repo moved: ${sourceRepo ?? record.fromCwd} -> ${targetRepo ?? record.toCwd}`, metadata: manifestMetadata });
		}
		if (mode === "move" && sourceObservationId && targetObservationId) {
			const reason = operationType === "repo_move" ? "relocated by repo move semantics" : `relocated by ${tool} move semantics`;
			pushUnique(store.observationMarks, seen.marks, { id: id("mark", sourceObservationId, "superseded", targetObservationId, record.ts), observationId: sourceObservationId, markType: "superseded", reason, replacementObservationId: targetObservationId, source: `${tool}-manifest`, timestamp: record.ts, confidence: record.inferred ? (record.confidence ?? "medium") : "authoritative", manualReviewRequired: true, metadata: { batchId: record.batchId, operationType, tool, sourceRepo, targetRepo } });
			pushUnique(store.observationMarks, seen.marks, { id: id("mark", sourceObservationId, "deletion_candidate", targetObservationId, record.ts), observationId: sourceObservationId, markType: "deletion_candidate", reason: "old copy after relocation; requires manual review before deletion", replacementObservationId: targetObservationId, source: `${tool}-manifest`, timestamp: record.ts, confidence: record.inferred ? (record.confidence ?? "medium") : "authoritative", manualReviewRequired: true, metadata: { batchId: record.batchId, operationType, tool, sourceRepo, targetRepo } });
		}
		for (const [type, value, targetId] of [["cwd", record.fromCwd, source.id], ["cwd", record.toCwd, target.id]] as const) if (value && !value.startsWith("(")) pushUnique(store.labels, seen.labels, { id: id("label", edgeId, type, targetId, value), targetType: "session", targetId, labelType: type, value, confidence: "authoritative", sourceId: manifestRecordSource });
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
	if (inventory) pushUnique(store.artifacts, seen.artifacts, { id: id("artifact", inventoryPath), kind: "inventory", path: inventoryPath, generatedAt, generator: "scripts/build-graphs.ts", metadata: { imported: true } });
	if (preManifest) store.checkpointArtifacts.push({ id: id("checkpoint", preManifestPath), kind: "curated_reconstruction_summary", path: preManifestPath, generatedAt, generator: "manual-curated-sidecar", inputHash: sha(JSON.stringify(preManifest)), privacyStatus: "metadata-only", summary: "Pre-manifest lineage curated reconstruction summary", metadata: { source: preManifestPath } });
	if (prefixLineage) store.checkpointArtifacts.push({ id: id("checkpoint", prefixLineagePath), kind: "prefix_lineage_summary", path: prefixLineagePath, generatedAt, generator: "scripts/reconstruct-prefix-lineage.ts", inputHash: sha(JSON.stringify(prefixLineage)), privacyStatus: "metadata-only", summary: "Prefix/common-prefix lineage reconstruction summary", metadata: { source: prefixLineagePath } });
	for (const path of checkpointCandidatePaths) {
		const raw = await readFile(path, "utf8").catch(() => undefined);
		if (!raw) continue;
		store.checkpointArtifacts.push({ id: id("checkpoint", path), kind: "report_checkpoint", path, generatedAt, generator: "agent-session-store", inputHash: sha(raw), privacyStatus: "metadata-only", summary: basename(path), metadata: { source: path } });
	}
	if (bucketReconciliation?.buckets) {
		for (const bucket of bucketReconciliation.buckets) {
			if (!bucket.root || !bucket.bucket || !bucket.status || !bucket.confidence) continue;
			const statusId = id("bucket", bucket.root, bucket.bucket);
			store.bucketStatuses.push({ id: statusId, root: bucket.root, bucket: bucket.bucket, decodedPath: bucket.decodedPath, status: bucket.status, confidence: bucket.confidence, sessionCount: bucket.sessionCount ?? 0, earliest: bucket.earliest, latest: bucket.latest, reasons: bucket.reasons ?? [], metadata: bucket });
			pushUnique(store.evidence, seen.evidence, { id: id("evidence", "bucket", bucket.root, bucket.bucket), kind: "bucket_reconciliation", sourceId: bucketReconciliationSource, confidence: bucket.confidence, summary: `${bucket.status}: ${bucket.decodedPath ?? bucket.bucket}`, data: bucket });
		}
		pushUnique(store.artifacts, seen.artifacts, { id: id("artifact", bucketReconciliationPath), kind: "bucket_reconciliation", path: bucketReconciliationPath, generatedAt, generator: "scripts/inventory-session-buckets.ts", metadata: { imported: true, bucketCount: bucketReconciliation.buckets.length } });
	}

	for (const repoPath of await findGitRoots(oldExtensionsDir)) {
		const info = await gitInfo(repoPath);
		const sourceId = addSource("git-repository", "git_repository", repoPath, relative(oldExtensionsDir, repoPath));
		pushUnique(store.repositories, seen.repos, { id: id("repo", repoPath), sourceId, path: repoPath, name: basename(repoPath), remoteUrl: info?.remote, vcs: (await exists(join(repoPath, ".jj"))) ? "git+jj" : "git", firstCommitAt: info?.firstAt, lastCommitAt: info?.lastAt, firstCommit: info?.firstHash, lastCommit: info?.lastHash, metadata: { firstSubject: info?.firstSubject, lastSubject: info?.lastSubject } });
		if (info) pushUnique(store.evidence, seen.evidence, { id: id("evidence", "git", repoPath), kind: "git_activity", sourceId: oldRepoSource, timestamp: info.lastAt, confidence: "high", summary: `${relative(oldExtensionsDir, repoPath)} activity ${info.firstAt} to ${info.lastAt}`, data: { path: repoPath, firstCommit: info.firstHash, firstSubject: info.firstSubject, lastCommit: info.lastHash, lastSubject: info.lastSubject, remote: info.remote } });
	}

	const repoIdentityId = (stableName?: string, explicit?: string) => explicit ?? (stableName ? id("repo_identity", stableName) : undefined);
	for (const record of repoIdentitySidecar) {
		if (record.kind !== "repo-identity") continue;
		pushUnique(store.repoIdentities, seen.repoIdentities, { id: repoIdentityId(record.stableName, record.id)!, stableName: record.stableName, displayName: record.displayName, description: record.description, confidence: record.confidence ?? "manual", source: "repo-identities.jsonl", metadata: record.metadata });
	}
	for (const record of repoIdentitySidecar) {
		if (record.kind === "repo-observation") {
			const rid = repoIdentityId(record.stableName, record.repoIdentityId);
			if (!rid) continue;
			pushUnique(store.repoObservations, seen.repoObservations, { id: id("repo_obs", rid, record.path, record.bucket, record.remoteUrl, record.validFrom, record.validTo), repoIdentityId: rid, path: record.path, bucket: record.bucket, remoteUrl: record.remoteUrl, validFrom: record.validFrom, validTo: record.validTo, confidence: record.confidence ?? "manual", source: "repo-identities.jsonl", metadata: { evidence: record.evidence, ...record.metadata } });
		} else if (record.kind === "repo-event") {
			const rid = repoIdentityId(record.stableName, record.repoIdentityId);
			const related = repoIdentityId(record.relatedStableName, record.relatedRepoIdentityId);
			pushUnique(store.repoEvents, seen.repoEvents, { id: id("repo_event", record.eventType, rid, related, record.fromPath, record.toPath, record.timestamp, record.summary), eventType: record.eventType, repoIdentityId: rid, relatedRepoIdentityId: related, fromPath: record.fromPath, toPath: record.toPath, timestamp: record.timestamp, confidence: record.confidence ?? "manual", source: "repo-identities.jsonl", manualReviewRequired: record.manualReviewRequired ?? true, summary: record.summary, metadata: { evidence: record.evidence, ...record.metadata } });
		}
	}
	if (repoIdentitySidecar.length) pushUnique(store.artifacts, seen.artifacts, { id: id("artifact", repoIdentitySidecarPath), kind: "repo_identity_sidecar", path: repoIdentitySidecarPath, generatedAt, generator: "manual-curated-sidecar", metadata: { imported: true, recordCount: repoIdentitySidecar.length } });

	debug("importing external provider sessions");
	await addExternalProviderSessions(store, seen, addSource);
	debug(`after external imports: ${store.sessions.length} sessions`);
	deriveCrossProviderContinuity(store, seen);
	debug(`after cross-provider continuity: ${store.edges.length} edges`);
	deriveAdditionalMetadata(store, seen, generatedAt);
	debug("after additional metadata");

	deriveLogicalThreads(store);
	debug("after logical threads");
	deriveResumeTargets(store);
	debug("after resume targets");
	store.sources.sort((a, b) => a.id.localeCompare(b.id));
	for (const key of ["sessions", "sessionObservations", "edges", "labels", "aliases", "classifications", "evidence", "backupObservations", "repositories", "artifacts", "checkpointArtifacts", "observationMarks", "batchOperations", "logicalThreads", "threadMembers", "threadEdges", "threadResumeTargets", "bucketStatuses", "repoIdentities", "repoObservations", "repoEvents"] as const) store[key].sort((a, b) => a.id.localeCompare(b.id));
	await mkdir(storeDir, { recursive: true });
	await mkdir(graphDir, { recursive: true });
	const out = JSON.stringify(store, null, 2) + "\n";
	debug("writing exports");
	await writeFile(join(storeDir, "session-store.export.json"), out);
	await writeFile(join(graphDir, "curated-store.json"), out);
	debug("writing sqlite");
	replaceSqlite(sqlitePath, store);
	console.log(`Wrote ${store.sessions.length} sessions, ${store.edges.length} edges, ${store.evidence.length} evidence records to ${join(storeDir, "session-store.export.json")}`);
	console.log(`Wrote SQLite store to ${sqlitePath}`);
}

await main();
