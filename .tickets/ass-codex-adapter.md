---
id: ass-codex-adapter
status: closed
deps: []
links: []
created: 2026-05-31T07:05:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Import Codex session JSONLs

Add a metadata-only adapter for Codex sessions under `/Users/sam/Downloads/coding-sessions/codex/sessions` and organized iCloud copies.

## Acceptance Criteria

- Import provider as `codex`.
- Scan configurable Codex session roots.
- Parse `session_meta`, `turn_context`, `event_msg`, and `response_item` rows.
- Extract provider session id, cwd, start timestamp, model/provider/version, first/last event timestamps, event type counts, line/byte/hash.
- Do not store raw transcript text by default.
- Link manual markdown exports later via artifact adapter rather than duplicate sessions.
- Update docs/import-adapters.md.
- TypeScript check passes.
