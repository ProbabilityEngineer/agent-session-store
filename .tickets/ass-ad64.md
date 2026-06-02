---
id: ass-ad64
status: closed
deps: []
links: []
created: 2026-06-02T18:29:35Z
type: task
priority: 1
assignee: ProbabilityEngineer
---
# Verify session-move manifest rebuild contract

Verify that agent-session-store can rebuild all required canonical data from pi-session-move raw evidence when pi-session-move was installed first and agent-session-store/pi-session-graph are installed later.

## Acceptance Criteria

- Confirm all fields needed by agent-session-store are present in ~/.pi/agent/session-move/manifests/relocations.jsonl and relocation-lineages.jsonl.
- Confirm agent-session-store reads both legacy paths (~/.pi/agent/relocations*.jsonl, relocation-lineages.jsonl) and namespaced session-move paths.
- Confirm absence of an existing session-store.sqlite is handled gracefully on first rebuild.
- Add/adjust tests or a smoke fixture covering delayed install: move facts first, rebuild store later.
- Document any missing fields or compatibility assumptions.

