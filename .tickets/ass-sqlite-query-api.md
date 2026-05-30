---
id: ass-sqlite-query-api
status: closed
deps: []
links: []
created: 2026-05-30T03:40:00Z
type: task
priority: 3
assignee: ProbabilityEngineer
---
# Add lightweight SQLite query/export helpers

Provide a small library or CLI helper for querying the canonical SQLite store and exporting graph-ready JSON for consumers like pi-session-graph.

## Acceptance Criteria

- Helper can read session-store.sqlite and emit graph-ready JSON equivalent to curated-store.json.
- Consumers do not need to know the full schema for basic graph data.
- npm run lint passes.
