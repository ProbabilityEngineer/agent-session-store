---
id: ass-logical-thread-tables
status: closed
deps: []
links: []
created: 2026-05-30T03:40:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Implement logical thread tables in SQLite/export

Implement derived logical thread support described in docs/canonical-store.md, without merging or rewriting raw session JSONLs.

## Acceptance Criteria

- SQLite schema/export includes logical thread and thread member records.
- Initial thread grouping can derive from relocation/continuation edges and shared provider session ids.
- Reports can list logical threads and members.
- Raw session files remain immutable.
- npm run lint passes.
