---
id: ass-checkpoint-artifacts
status: open
deps: [ass-logical-thread-tables]
links: []
created: 2026-05-30T03:40:00Z
type: feature
priority: 3
assignee: ProbabilityEngineer
---
# Implement derived checkpoint/summary artifact records

Add store support for finite-context checkpoint/summary artifacts linked to logical threads or session observations.

## Acceptance Criteria

- Store schema/export can record checkpoint/summary artifacts with provenance, timestamps, input hashes, privacy status, and linked sessions/threads.
- No raw transcript content is stored by default.
- Reports list available checkpoints.
- npm run lint passes.
