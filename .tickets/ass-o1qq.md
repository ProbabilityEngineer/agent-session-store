---
id: ass-o1qq
status: open
deps: []
links: []
created: 2026-05-30T02:53:29Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [sqlite, store, schema]
---
# Implement SQLite canonical store schema

Implement the SQLite database schema described in docs/canonical-store.md, including tables for sources, import_runs, sessions, session_observations, events, edges, labels, aliases, classifications, evidence, backup_observations, repositories, and artifacts. Keep the existing JSON export as a portable companion format.

## Acceptance Criteria

A script creates/updates ~/.pi/agent/session-store/session-store.sqlite with the canonical schema; schema initialization is idempotent; npm run lint passes; README documents SQLite path and relationship to JSON export.

