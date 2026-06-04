---
id: ass-npg7
status: closed
deps: []
links: []
created: 2026-06-03T03:26:53Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [sqlite, metrics, privacy, canonical-store]
---
# Index provider session events into SQLite

Add event-level SQLite indexing for canonical session data. Store metadata for each event/row without raw transcript content by default: session_id, observation_id, provider, source path, row_number, byte_offset where available, timestamp, role/event_type, content_hash, byte_count/token_count when available. Use this as the foundation for visit row metrics and active-hours calculations.

## Acceptance Criteria

SQLite schema includes session_events or equivalent; Pi JSONL rows are indexed with row numbers and timestamps where available; raw transcript text is not stored by default; rebuild/export remains deterministic; existing session/session_observation exports still work.

