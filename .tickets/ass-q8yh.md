---
id: ass-q8yh
status: closed
deps: []
links: []
created: 2026-06-04T23:28:16Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [repo-identity, renames, dedupe, active-hours]
---
# Detect repo rename and identity candidates

Detect likely renamed/moved projects across provider session cwd paths and repo observations. Compare signals including same git remote, overlapping commit history when local repos exist, explicit repo move/rename manifests, path/name similarity, shared parent directories, and temporal continuity of work. Produce candidate repo identity merges with confidence and evidence; do not silently merge weak candidates.

## Acceptance Criteria

Build or a dedicated command emits repo identity candidate report/json; candidates include old/new paths, suggested stableName/displayName, confidence, evidence signals, and whether manual approval is required; high-confidence same-remote/history candidates are distinguished from weak name-similarity candidates; no raw transcript content is included.

