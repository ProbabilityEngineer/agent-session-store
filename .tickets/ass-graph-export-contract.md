---
id: ass-graph-export-contract
status: open
deps: []
links:
  - ../pi-session-graph/.tickets/psg-store-graph-boundary.md
created: 2026-06-01T14:35:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Define graph export contract for renderers

Define the canonical graph export contract consumed by `pi-session-graph` and future viewers.

## Acceptance Criteria

- Document stable node, edge, evidence, label, repo identity, logical thread, work burst, and temporal activity shapes.
- Include confidence/provenance/status fields consistently.
- Preserve backward compatibility for current `graph-export.json`/`curated-store.json` consumers.
- Provide sample export snippets for session lineage, compaction/fork edges, repo identity, temporal spans, and activity metrics.
- Make clear that canonical inference happens here; renderers should not parse raw transcripts or infer identity.
