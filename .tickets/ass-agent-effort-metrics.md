---
id: ass-agent-effort-metrics
status: open
deps: [ass-provider-activity-summaries, ass-graph-export-contract]
links:
  - ../pi-session-graph/.tickets/psg-agent-accrued-effort-lanes.md
created: 2026-06-01T14:35:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Export agent/provider accrued effort metrics

Compute privacy-preserving activity metrics that renderers can show across repo lanes and agent/provider lineages.

## Acceptance Criteria

- Export per-session and aggregate activity metrics where available: session count, event/message/turn count, tool count, token count when present, first/last timestamps, and evidence-derived activity score.
- Aggregate by provider, repo identity/cwd, logical thread, work burst, and time window where deterministic.
- Distinguish wall-clock span from accrued activity.
- Include provenance and missing-data notes per provider.
- Do not store raw transcript text by default.
