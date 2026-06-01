---
id: ass-promote-contract-fields
status: closed
type: feature
priority: 1
created: 2026-06-01T00:00:00Z
---
# Promote contract fields out of metadata

Fields that store/replay/graph logic branches on should be first-class/top-level in canonical records and exports, not buried in `metadata_json`.

## Candidate fields

- relocation manifest: `operationType`, `tool`, `mode`, `batchId`, `sourceRepo`, `targetRepo`
- edge/session export: `mode`, `batchId`, `sourceProvider`, `targetProvider`, `repoIdentityId` where these drive classification/filtering
- temporal/activity exports: keep existing top-level `providers`, `sessionIds`, `start`, `end`, `sessionCount`; avoid relying on duplicated metadata copies
- preserve marks: `label` may deserve top-level if graph/status displays it as a stable branch label

## Acceptance Criteria

- Audit current `metadata_json` reads for fields used by logic.
- Add top-level TypeScript fields and SQLite columns or projection fields where useful.
- Keep compatibility fallback from historical `metadata_json`.
- Export top-level fields in `session-store.export.json` and `graph-export.json`.
- Document the rule: logic/filter/display contract fields are top-level; metadata remains optional/debug/detail.
