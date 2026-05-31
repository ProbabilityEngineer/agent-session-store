---
id: ass-repo-relationship-reports
status: closed
deps: [ass-repo-identity-model]
links: []
created: 2026-05-31T05:30:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Report time use and relationships by repo identity

Add reports/exports that aggregate sessions, observations, and lineage by stable repo identity rather than only cwd path.

## Acceptance Criteria

- Generate a repo identity timeline report.
- Show path/bucket observations attached to each identity.
- Show rename/move/swap/fork/archive events.
- Aggregate session counts/time windows per repo identity where evidence allows.
- Flag ambiguous path-only observations separately.
- Export graph-ready repo relationship data for `pi-session-graph`.
