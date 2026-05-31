---
id: ass-rovodev-adapter
status: open
deps: []
links: []
created: 2026-05-31T06:50:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Import Rovo Dev session archives

Add a metadata-only adapter for Rovo Dev session data under `/Users/sam/Downloads/coding-sessions/rovodev` and organized iCloud copies.

## Observed structure

- `sessions/<workspace-agent-id>/metadata.json`
- `sessions/<workspace-agent-id>/session_context.json`
- `config.yml`
- `prompt_history`

Sample metadata includes title and workspace path. `session_context.json` includes id, metadata artifact, and message history.

## Acceptance Criteria

- Import provider as `rovodev`.
- Parse session id from `session_context.json` and directory name.
- Extract metadata-only facts: title, workspace path, message count, first/last message timestamps when available, byte/hash counts.
- Import prompt_history/config as artifacts/evidence, not sessions.
- Do not store raw transcript text by default.
- Update docs/import-adapters.md.
- TypeScript check passes.
