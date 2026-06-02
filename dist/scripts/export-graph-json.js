#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const home = process.env.HOME ?? ".";
const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi", "agent");
const storeDir = process.env.AGENT_SESSION_STORE_DIR ?? join(agentDir, "session-store");
const graphDir = join(agentDir, "session-graph");
const dbPath = join(storeDir, "session-store.sqlite");
function parseJson(value, fallback) {
    if (typeof value !== "string")
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
const db = new DatabaseSync(dbPath, { readOnly: true });
try {
    const allSessions = db.prepare("SELECT id, provider, provider_session_id, canonical_key, first_seen_at, last_seen_at, start_timestamp, end_timestamp, line_count, byte_count, content_sha256, metadata_json FROM sessions ORDER BY id").all().map((row) => ({ id: row.id, provider: row.provider, providerSessionId: row.provider_session_id, canonicalKey: row.canonical_key, firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at, startTimestamp: row.start_timestamp, endTimestamp: row.end_timestamp, lineCount: row.line_count, byteCount: row.byte_count, contentSha256: row.content_sha256, metadata: parseJson(row.metadata_json, {}) }));
    const edges = db.prepare("SELECT id, source_session_id, target_session_id, edge_type, timestamp, source_observation_id, target_observation_id, confidence, provenance, metadata_json FROM edges ORDER BY id").all().map((row) => {
        const metadata = parseJson(row.metadata_json, {});
        return { id: row.id, sourceSessionId: row.source_session_id, targetSessionId: row.target_session_id, edgeType: row.edge_type, timestamp: row.timestamp, sourceObservationId: row.source_observation_id, targetObservationId: row.target_observation_id, confidence: row.confidence, provenance: row.provenance, operationType: metadata.operationType, tool: metadata.tool, mode: metadata.mode, batchId: metadata.batchId, sourceRepo: metadata.sourceRepo, targetRepo: metadata.targetRepo, metadata };
    });
    const connectedSessionIds = new Set();
    for (const edge of edges) {
        connectedSessionIds.add(edge.sourceSessionId);
        connectedSessionIds.add(edge.targetSessionId);
    }
    const isNoise = (session) => Boolean(session.metadata.trivial) || Boolean(session.metadata.testSession) || ((session.lineCount ?? 0) <= 1 && Boolean(session.metadata.eventCounts));
    const sessions = allSessions.filter((session) => connectedSessionIds.has(session.id) || !isNoise(session));
    const includedSessionIds = new Set(sessions.map((session) => session.id));
    const labels = db.prepare("SELECT target_type, target_id, label_type, value, confidence, metadata_json FROM labels ORDER BY id").all().map((row) => ({ targetType: row.target_type, targetId: row.target_id, labelType: row.label_type, value: row.value, confidence: row.confidence, metadata: parseJson(row.metadata_json, {}) })).filter((label) => label.targetType !== "session" || includedSessionIds.has(label.targetId));
    const classifications = db.prepare("SELECT target_type, target_id, classification, confidence, source, metadata_json FROM classifications ORDER BY id").all().map((row) => ({ targetType: row.target_type, targetId: row.target_id, classification: row.classification, confidence: row.confidence, source: row.source, metadata: parseJson(row.metadata_json, {}) }));
    const allLogicalThreads = db.prepare("SELECT id, label, confidence, source, metadata_json FROM logical_threads ORDER BY id").all().map((row) => ({ id: row.id, label: row.label, confidence: row.confidence, source: row.source, metadata: parseJson(row.metadata_json, {}) }));
    const threadMembers = db.prepare("SELECT thread_id, session_id, observation_id, role, ordinal, metadata_json FROM thread_members ORDER BY thread_id, ordinal").all().map((row) => ({ threadId: row.thread_id, sessionId: row.session_id, observationId: row.observation_id, role: row.role, ordinal: row.ordinal, metadata: parseJson(row.metadata_json, {}) })).filter((member) => includedSessionIds.has(member.sessionId));
    const includedThreadIds = new Set(threadMembers.map((member) => member.threadId));
    const logicalThreads = allLogicalThreads.filter((thread) => includedThreadIds.has(thread.id));
    const threadEdges = db.prepare("SELECT thread_id, source_session_id, target_session_id, relation, edge_id, confidence, source, metadata_json FROM thread_edges ORDER BY id").all().map((row) => ({ threadId: row.thread_id, sourceSessionId: row.source_session_id, targetSessionId: row.target_session_id, relation: row.relation, edgeId: row.edge_id, confidence: row.confidence, source: row.source, metadata: parseJson(row.metadata_json, {}) })).filter((edge) => includedThreadIds.has(edge.threadId) && includedSessionIds.has(edge.sourceSessionId) && includedSessionIds.has(edge.targetSessionId));
    const threadResumeTargets = db.prepare("SELECT thread_id, status, recommended_session_id, recommended_observation_id, active_leaf_session_ids_json, recoverable_session_ids_json, reasons_json, metadata_json FROM thread_resume_targets ORDER BY thread_id").all().map((row) => ({ threadId: row.thread_id, status: row.status, recommendedSessionId: row.recommended_session_id, recommendedObservationId: row.recommended_observation_id, activeLeafSessionIds: parseJson(row.active_leaf_session_ids_json, []).filter((id) => includedSessionIds.has(id)), recoverableSessionIds: parseJson(row.recoverable_session_ids_json, []).filter((id) => includedSessionIds.has(id)), reasons: parseJson(row.reasons_json, []), metadata: parseJson(row.metadata_json, {}) })).filter((target) => includedThreadIds.has(target.threadId));
    const observationMarks = db.prepare("SELECT observation_id, mark_type, reason, replacement_observation_id, source, timestamp, confidence, manual_review_required, metadata_json FROM observation_marks ORDER BY id").all().map((row) => ({ observationId: row.observation_id, markType: row.mark_type, reason: row.reason, replacementObservationId: row.replacement_observation_id, source: row.source, timestamp: row.timestamp, confidence: row.confidence, manualReviewRequired: Boolean(row.manual_review_required), metadata: parseJson(row.metadata_json, {}) }));
    const observationSessionIds = new Map(threadMembers.map((member) => [member.observationId, member.sessionId]));
    const includedObservationMarks = observationMarks.filter((mark) => includedSessionIds.has(observationSessionIds.get(mark.observationId) ?? ""));
    const preservedBranches = includedObservationMarks.filter((mark) => mark.markType === "preserve" || mark.markType === "intentional_branch").map((mark) => ({ ...mark, sessionId: observationSessionIds.get(mark.observationId), label: mark.metadata?.label }));
    const repoIdentities = db.prepare("SELECT id, stable_name, display_name, description, confidence, source, metadata_json FROM repo_identities ORDER BY stable_name").all().map((row) => ({ id: row.id, stableName: row.stable_name, displayName: row.display_name, description: row.description, confidence: row.confidence, source: row.source, metadata: parseJson(row.metadata_json, {}) }));
    const repoObservations = db.prepare("SELECT id, repo_identity_id, path, bucket, remote_url, valid_from, valid_to, confidence, source, evidence_id, metadata_json FROM repo_observations ORDER BY id").all().map((row) => ({ id: row.id, repoIdentityId: row.repo_identity_id, path: row.path, bucket: row.bucket, remoteUrl: row.remote_url, validFrom: row.valid_from, validTo: row.valid_to, confidence: row.confidence, source: row.source, evidenceId: row.evidence_id, metadata: parseJson(row.metadata_json, {}) }));
    const repoEvents = db.prepare("SELECT id, event_type, repo_identity_id, related_repo_identity_id, from_path, to_path, timestamp, confidence, source, evidence_id, manual_review_required, summary, metadata_json FROM repo_events ORDER BY id").all().map((row) => {
        const metadata = parseJson(row.metadata_json, {});
        return { id: row.id, eventType: row.event_type, repoIdentityId: row.repo_identity_id, relatedRepoIdentityId: row.related_repo_identity_id, fromPath: row.from_path, toPath: row.to_path, timestamp: row.timestamp, confidence: row.confidence, source: row.source, evidenceId: row.evidence_id, manualReviewRequired: Boolean(row.manual_review_required), summary: row.summary, operationType: metadata.operationType, tool: metadata.tool, sourceRepo: metadata.sourceRepo, targetRepo: metadata.targetRepo, metadata };
    });
    const compactionEvents = db.prepare("SELECT id, source_id, target_id, timestamp, confidence, summary, data_json FROM evidence WHERE kind = 'compaction_summary' ORDER BY timestamp, id").all().map((row) => {
        const metadata = parseJson(row.data_json, {});
        return { id: row.id, kind: "compaction_summary", sessionId: row.target_id, sourceId: row.source_id, timestamp: row.timestamp, confidence: row.confidence, provenance: metadata.provenance ?? "pi-session-jsonl", privacyStatus: metadata.privacyStatus ?? "metadata-only", eventCount: metadata.eventCount ?? 0, summaryEventCount: metadata.summaryEventCount ?? 0, compactedLineCount: metadata.compactedLineCount ?? 0, compactedCharCount: metadata.compactedCharCount ?? 0, firstCompactionAt: metadata.firstCompactionAt, lastCompactionAt: metadata.lastCompactionAt, summaryHashes: metadata.summaryHashes ?? [], sampleLines: metadata.sampleLines ?? [], summary: row.summary, metadata };
    }).filter((event) => includedSessionIds.has(event.sessionId));
    const workBursts = db.prepare("SELECT id, kind, path, generated_at, generator, metadata_json FROM artifacts WHERE kind = 'temporal_work_burst' ORDER BY generated_at, id").all().map((row) => {
        const metadata = parseJson(row.metadata_json, {});
        return { id: row.id, kind: row.kind, path: row.path, generatedAt: row.generated_at, generator: row.generator, repoIdentityId: metadata.repoIdentityId, sessionIds: metadata.sessionIds ?? [], providers: metadata.providers ?? [], start: metadata.start, end: metadata.end, sessionCount: metadata.sessionCount ?? 0, confidence: "derived", provenance: row.generator, metadata };
    });
    const temporalActivitySpans = sessions.flatMap((session) => {
        const start = session.startTimestamp ?? session.firstSeenAt;
        const end = session.endTimestamp ?? session.lastSeenAt ?? start;
        if (!start)
            return [];
        const eventCounts = typeof session.metadata?.eventCounts === "object" && session.metadata.eventCounts ? session.metadata.eventCounts : {};
        const eventCount = Object.values(eventCounts).reduce((sum, value) => sum + (typeof value === "number" ? value : 0), 0) || undefined;
        const toolCount = Object.entries(eventCounts).filter(([key]) => /tool|command|exec|edit|write|read|patch/i.test(key)).reduce((sum, [, value]) => sum + (typeof value === "number" ? value : 0), 0) || undefined;
        const messageCount = typeof session.metadata?.messageCount === "number" ? session.metadata.messageCount : eventCounts.message;
        const activityScore = (eventCount ?? 0) + (toolCount ?? 0) + (messageCount ?? 0);
        return [{ id: `span_${session.id}`, sessionId: session.id, provider: session.provider, providerSessionId: session.providerSessionId, repoIdentityId: session.metadata?.repoIdentityId, cwd: session.metadata?.cwd, label: session.metadata?.displayName ?? session.metadata?.cwd ?? session.providerSessionId ?? session.id, start, end, lineCount: session.lineCount, byteCount: session.byteCount, eventCount, messageCount, toolCount, activityScore, confidence: "derived", provenance: "session-metadata" }];
    });
    const activityMetricMap = new Map();
    for (const span of temporalActivitySpans) {
        const key = [span.provider, span.repoIdentityId ?? span.cwd ?? "unknown"].join("::");
        const metric = activityMetricMap.get(key) ?? { id: `activity_${activityMetricMap.size + 1}`, provider: span.provider, repoIdentityId: span.repoIdentityId, cwd: span.cwd, sessionCount: 0, eventCount: 0, messageCount: 0, toolCount: 0, lineCount: 0, byteCount: 0, activityScore: 0, firstStart: span.start, lastEnd: span.end, confidence: "derived", provenance: "session-metadata-aggregate", missingDataNotes: [] };
        metric.sessionCount += 1;
        metric.eventCount += span.eventCount ?? 0;
        metric.messageCount += span.messageCount ?? 0;
        metric.toolCount += span.toolCount ?? 0;
        metric.lineCount += span.lineCount ?? 0;
        metric.byteCount += span.byteCount ?? 0;
        metric.activityScore += span.activityScore ?? 0;
        if (span.start < metric.firstStart)
            metric.firstStart = span.start;
        if (span.end > metric.lastEnd)
            metric.lastEnd = span.end;
        if (span.eventCount === undefined)
            metric.missingDataNotes.push(`event counts missing for ${span.sessionId}`);
        activityMetricMap.set(key, metric);
    }
    const activityMetrics = [...activityMetricMap.values()];
    const graphFilters = { excludedNoiseSessions: allSessions.length - sessions.length, policy: "exclude trivial/test sessions without lineage edges from graph exports; keep them in canonical SQLite/export store" };
    const payload = { generatedAt: new Date().toISOString(), source: dbPath, graphFilters, sessions, edges, labels, classifications, observationMarks: includedObservationMarks, preservedBranches, logicalThreads, threadMembers, threadEdges, threadResumeTargets, repoIdentities, repoObservations, repoEvents, compactionEvents, workBursts, temporalActivitySpans, activityMetrics };
    await mkdir(storeDir, { recursive: true });
    await mkdir(graphDir, { recursive: true });
    const out = JSON.stringify(payload, null, 2) + "\n";
    await writeFile(join(storeDir, "graph-export.json"), out);
    await writeFile(join(graphDir, "curated-store.json"), out);
    console.log(`Wrote ${join(storeDir, "graph-export.json")}`);
}
finally {
    db.close();
}
//# sourceMappingURL=export-graph-json.js.map