---
id: ass-backfill-top-level-fields
status: closed
type: task
priority: 1
created: 2026-06-01T00:00:00Z
---
# Backfill top-level fields from historical metadata

Historical records may have contract fields nested under metadata. Add rebuild-time backfill so canonical store/export fields are populated without mutating raw evidence.

## Acceptance Criteria

- During store rebuild, read top-level values first and fall back to metadata values.
- Backfill at least `mode`, `batchId`, `operationType`, `tool`, `sourceRepo`, `targetRepo`, `repoIdentityId`, `sourceProvider`, and `targetProvider` where present.
- Store/export records indicate provenance/fallback where useful without changing raw JSONL manifests.
- Add validation/reporting for records that still lack expected contract fields.
- No mutation of `~/.pi/agent/relocations.jsonl`.
