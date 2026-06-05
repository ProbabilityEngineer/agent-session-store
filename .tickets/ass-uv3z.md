---
id: ass-uv3z
status: closed
deps: []
links: []
created: 2026-06-05T01:15:24Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [active-hours, dedupe, repo-identity, overlap]
---
# Collapse duplicate overlapping active-time spans by project identity

Add canonical de-duplication for overlapping equivalent sessions before aggregating project active time. Relocated/copy-equivalent sessions can overlap heavily and currently cause misleading totals in graph exports. Aggregation should operate per repoIdentityId/project and use session equivalence/duplicate evidence, row ranges, and timestamps to avoid summing the same work repeatedly.

## Acceptance Criteria

active_time_metric aggregation collapses overlapping duplicate/equivalent sessions per repoIdentityId/project; metadata records collapsed session IDs and rationale; graph-export activeTimeMetrics and temporalActivitySpans distinguish raw spans from deduped aggregate spans; duplicate candidate evidence is used where available; validation reports projects affected by dedupe.

