---
id: ass-factory-adapter
status: closed
deps: []
links: []
created: 2026-05-31T07:05:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Import Factory session JSONLs

Add a metadata-only adapter for Factory sessions under `/Users/sam/Downloads/coding-sessions/factory/sessions` and organized iCloud copies.

## Acceptance Criteria

- Import provider as `factory`.
- Parse `session_start`, `message`, and `todo_state` rows.
- Extract session id, cwd, title/sessionTitle, owner, version, event counts, first/last timestamps, line/byte/hash.
- Pair `.settings.json` sidecars with matching session files as metadata/artifacts.
- Mark one-row `session_start`-only sessions as trivial/test observations.
- Do not store raw transcript text by default.
- Update docs/import-adapters.md.
- TypeScript check passes.
