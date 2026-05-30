---
id: ass-2p8s
status: closed
deps: []
links: []
created: 2026-05-30T03:15:16Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [threads, merge, lineage, store]
---
# Add derived logical session/thread merge model

Design and implement a derived logical merge model that groups related raw session files into logical threads/lineages without mutating or concatenating raw JSONLs. Support canonical path selection, forks, continuations, and future summarized checkpoints.

## Acceptance Criteria

Canonical store design includes logical_threads and thread_members or equivalent; raw session files remain immutable; reports can show grouped logical sessions; merging is derived metadata only, not raw JSONL rewriting.

