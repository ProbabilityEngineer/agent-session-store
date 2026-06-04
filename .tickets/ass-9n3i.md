---
id: ass-9n3i
status: closed
deps: []
links: []
created: 2026-06-04T23:28:29Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [active-hours, repo-identity, metrics, aggregation]
---
# Aggregate active hours by canonical repo identity

Change active-time aggregation to prefer canonical repoIdentityId/stableName over raw cwd whenever repo identity evidence exists. Once renamed project paths are linked, active_time_metric artifacts should aggregate all aliases/paths for the same project while preserving path-level drilldown metadata.

## Acceptance Criteria

active_time_metric artifacts aggregate by repoIdentityId/stableName when available; metadata includes contributing paths, session IDs, providers, and confidence/provenance; renamed projects such as cypv1/checkyourphotosv1/check-your-photos-v1 can appear as one project after identity approval; raw cwd fallback remains for unlinked projects.

