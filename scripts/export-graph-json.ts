#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(agentDir, "session-store");
const graphDir = join(agentDir, "session-graph");
const dbPath = join(storeDir, "session-store.sqlite");

function parseJson<T>(value: unknown, fallback: T): T {
	if (typeof value !== "string") return fallback;
	try { return JSON.parse(value) as T; } catch { return fallback; }
}

const db = new DatabaseSync(dbPath, { readOnly: true });
try {
	const sessions = db.prepare("SELECT id, provider, provider_session_id, canonical_key, first_seen_at, last_seen_at, start_timestamp, end_timestamp, line_count, byte_count, content_sha256, metadata_json FROM sessions ORDER BY id").all().map((row: any) => ({ id: row.id, provider: row.provider, providerSessionId: row.provider_session_id, canonicalKey: row.canonical_key, firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at, startTimestamp: row.start_timestamp, endTimestamp: row.end_timestamp, lineCount: row.line_count, byteCount: row.byte_count, contentSha256: row.content_sha256, metadata: parseJson(row.metadata_json, {}) }));
	const edges = db.prepare("SELECT id, source_session_id, target_session_id, edge_type, timestamp, source_observation_id, target_observation_id, confidence, provenance, metadata_json FROM edges ORDER BY id").all().map((row: any) => ({ id: row.id, sourceSessionId: row.source_session_id, targetSessionId: row.target_session_id, edgeType: row.edge_type, timestamp: row.timestamp, sourceObservationId: row.source_observation_id, targetObservationId: row.target_observation_id, confidence: row.confidence, provenance: row.provenance, metadata: parseJson(row.metadata_json, {}) }));
	const labels = db.prepare("SELECT target_type, target_id, label_type, value, confidence, metadata_json FROM labels ORDER BY id").all().map((row: any) => ({ targetType: row.target_type, targetId: row.target_id, labelType: row.label_type, value: row.value, confidence: row.confidence, metadata: parseJson(row.metadata_json, {}) }));
	const classifications = db.prepare("SELECT target_type, target_id, classification, confidence, source, metadata_json FROM classifications ORDER BY id").all().map((row: any) => ({ targetType: row.target_type, targetId: row.target_id, classification: row.classification, confidence: row.confidence, source: row.source, metadata: parseJson(row.metadata_json, {}) }));
	const logicalThreads = db.prepare("SELECT id, label, confidence, source, metadata_json FROM logical_threads ORDER BY id").all().map((row: any) => ({ id: row.id, label: row.label, confidence: row.confidence, source: row.source, metadata: parseJson(row.metadata_json, {}) }));
	const threadMembers = db.prepare("SELECT thread_id, session_id, observation_id, role, ordinal, metadata_json FROM thread_members ORDER BY thread_id, ordinal").all().map((row: any) => ({ threadId: row.thread_id, sessionId: row.session_id, observationId: row.observation_id, role: row.role, ordinal: row.ordinal, metadata: parseJson(row.metadata_json, {}) }));
	const threadEdges = db.prepare("SELECT thread_id, source_session_id, target_session_id, relation, edge_id, confidence, source, metadata_json FROM thread_edges ORDER BY id").all().map((row: any) => ({ threadId: row.thread_id, sourceSessionId: row.source_session_id, targetSessionId: row.target_session_id, relation: row.relation, edgeId: row.edge_id, confidence: row.confidence, source: row.source, metadata: parseJson(row.metadata_json, {}) }));
	const threadResumeTargets = db.prepare("SELECT thread_id, status, recommended_session_id, recommended_observation_id, active_leaf_session_ids_json, recoverable_session_ids_json, reasons_json, metadata_json FROM thread_resume_targets ORDER BY thread_id").all().map((row: any) => ({ threadId: row.thread_id, status: row.status, recommendedSessionId: row.recommended_session_id, recommendedObservationId: row.recommended_observation_id, activeLeafSessionIds: parseJson(row.active_leaf_session_ids_json, []), recoverableSessionIds: parseJson(row.recoverable_session_ids_json, []), reasons: parseJson(row.reasons_json, []), metadata: parseJson(row.metadata_json, {}) }));
	const payload = { generatedAt: new Date().toISOString(), source: dbPath, sessions, edges, labels, classifications, logicalThreads, threadMembers, threadEdges, threadResumeTargets };
	await mkdir(storeDir, { recursive: true });
	await mkdir(graphDir, { recursive: true });
	const out = JSON.stringify(payload, null, 2) + "\n";
	await writeFile(join(storeDir, "graph-export.json"), out);
	await writeFile(join(graphDir, "curated-store.json"), out);
	console.log(`Wrote ${join(storeDir, "graph-export.json")}`);
} finally {
	db.close();
}
