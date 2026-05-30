---
id: ass-ofah
status: closed
deps: []
links: []
created: 2026-05-30T02:53:34Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [sqlite, store, export]
---
# Write curated store records to SQLite

Extend the current build-store pipeline so the normalized store records generated from relocations, overlays, live Pi sessions, sidecars, backup observations, and repository evidence are written to SQLite as well as session-store.export.json.

## Acceptance Criteria

npm run build-store writes both ~/.pi/agent/session-store/session-store.sqlite and session-store.export.json; row counts in SQLite match the JSON export for core tables; writes are idempotent/deduplicated; npm run lint passes.

