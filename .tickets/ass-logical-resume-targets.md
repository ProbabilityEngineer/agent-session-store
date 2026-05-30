---
id: ass-logical-resume-targets
status: closed
deps: [ass-logical-thread-tables, ass-observation-availability]
links: []
created: 2026-05-30T04:00:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Compute deterministic resume targets for logical threads

For each logical thread, compute active leaves and canonical resume targets. If one active leaf exists, recommend it. If multiple active leaves exist, expose branch choices. If no active leaf exists, expose latest recoverable session or checkpoint-start option.

## Acceptance Criteria

- Store/export includes per-thread active leaves and recommended resume target when deterministic.
- Multiple active branches are represented explicitly, not collapsed.
- Unavailable/superseded sessions are hidden from normal resume suggestions but remain recoverable.
- Report documents resume target decisions and reasons.
- npm run lint passes.
