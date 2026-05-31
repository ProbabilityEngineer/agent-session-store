---
id: ass-opencode-adapter
status: open
deps: []
links: []
created: 2026-05-31T07:05:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Import OpenCode multi-file session storage

Add a metadata-only adapter for OpenCode session storage under `/Users/sam/Downloads/coding-sessions/opencode-sessions/storage` and organized iCloud copies.

## Acceptance Criteria

- Import provider as `opencode`.
- Parse `storage/session/*/*.json` for session id, project id, directory/cwd, title/slug, created/updated times.
- Count/link `storage/message/<session-id>/*.json` and `storage/part/**` by session id.
- Aggregate message counts, token/cost summaries where present, and first/last timestamps.
- Import project/session_diff/todo records as metadata/artifacts where useful.
- Do not store raw message/part text by default.
- Update docs/import-adapters.md.
- TypeScript check passes.
