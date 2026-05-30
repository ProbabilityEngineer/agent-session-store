---
id: ass-deterministic-thread-rules
status: closed
deps: [ass-logical-thread-tables]
links: []
created: 2026-05-30T04:00:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Implement deterministic logical thread classification rules

Define and implement deterministic rules for classifying session relationships as continuation, fork, sibling, context_jump, unrelated, or unknown.

Rules should use explicit relocation manifests, common JSONL prefixes, session ids, relocation filename/timestamp evidence, source line count at event, destination birthtime, cwd/project labels, and post-relocation source activity. Model/Semble suggestions may be recorded as candidates later but must not be authoritative.

## Acceptance Criteria

- Store design/docs describe deterministic relationship rules.
- Store builder emits relationship classifications or thread edges using deterministic evidence.
- Overlapping sessions are classified as forks/parallel siblings rather than forcibly merged.
- Context jumps remain separate from continuations.
- npm run lint passes.
