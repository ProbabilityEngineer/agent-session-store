---
id: ass-late-adapter
status: open
deps: []
links: []
created: 2026-05-31T07:05:00Z
type: feature
priority: 3
assignee: ProbabilityEngineer
---
# Import Late session JSON histories

Add a low-priority metadata-only adapter for Late sessions under `/Users/sam/Downloads/coding-sessions/late/sessions` and organized iCloud copies.

## Acceptance Criteria

- Import provider as `late`.
- Pair `session-*.json` histories with `session-*.meta.json` metadata.
- Extract id, title, created/updated timestamps, message_count, last_user_prompt, role counts, byte/hash counts.
- Mark trivial `hi`/`/help`/`/quit` sessions as trivial/test observations.
- Do not store raw transcript text by default.
- Update docs/import-adapters.md.
- TypeScript check passes.
