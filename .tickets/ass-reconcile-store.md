---
id: ass-reconcile-store
status: open
deps: []
links: []
created: 2026-05-30T03:40:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Import bucket reconciliation statuses into SQLite

Persist `session-bucket-reconciliation.json` results into the canonical SQLite/JSON store as evidence/classifications or dedicated bucket status records.

## Acceptance Criteria

- Reconciliation statuses are written to the canonical store.
- Statuses include confidence, reasons, cwd candidates, manifest/overlay evidence, same-basename candidates, and source root.
- Missing buckets remain `missing-unclassified` unless curated evidence supports stronger labels.
- npm run lint passes.
