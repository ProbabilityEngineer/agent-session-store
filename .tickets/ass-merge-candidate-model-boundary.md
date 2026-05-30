---
id: ass-merge-candidate-model-boundary
status: open
deps: [ass-deterministic-thread-rules]
links: []
created: 2026-05-30T04:00:00Z
type: task
priority: 3
assignee: ProbabilityEngineer
---
# Define model/Semble boundary for merge suggestions

Document how semantic/model tools may suggest logical merge candidates without becoming authoritative. Suggestions should record candidate relation, confidence, reasons, and supporting metadata/hashes, requiring deterministic evidence or human acceptance before changing thread membership.

## Acceptance Criteria

- Docs distinguish deterministic classifications from model-suggested merge candidates.
- Store has a place for model suggestion records or a planned schema.
- No graph/resume behavior depends solely on model suggestions.
- npm run lint passes.
