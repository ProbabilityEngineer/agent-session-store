---
id: ass-3i5y
status: open
deps: []
links: []
created: 2026-06-03T03:27:16Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [exports, graph-json, metrics, privacy]
---
# Export enriched metrics to graph/report JSON

Extend session-store.export.json and graph-export.json to include event/visit/activity summaries from SQLite: sessionRows, timestampedRows, arrivalRow, departureRow, visitRows, activeMinutes, workBlockCount, isLeaf, leafSince, branchFanoutCount, incoming/outgoing move counts, and metric confidence/provenance. Keep graph-export lightweight and privacy-preserving.

## Acceptance Criteria

graph-export.json exposes enough metrics for pi-session-graph to label sessions/edges with active time and visit rows; session-store.export.json retains richer provenance; schema version is updated; existing pi-session-graph report generation remains compatible with missing metrics.

