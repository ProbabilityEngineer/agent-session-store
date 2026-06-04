---
id: ass-2avj
status: open
deps: []
links: []
created: 2026-06-03T03:27:05Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [metrics, visit-rows, lineage, graph-export]
---
# Compute visit row metrics for movement edges

Compute row-level visit metrics for relocated/moved sessions using event timestamps and move timestamps. Derive arrivalRow, departureRow, visitRows, timestampCoverage, and confidence/provenance for each visit/movement segment. Use event-level SQLite index rather than current snapshot lineCount.

## Acceptance Criteria

For move/relocation edges, exports include arrivalRow, departureRow, visitRows, and metric confidence when reconstructable; metrics distinguish indexed session rows from visit rows; rows lacking timestamps reduce confidence; pi-session-graph can render visitRows without using ambiguous current lineCount.

