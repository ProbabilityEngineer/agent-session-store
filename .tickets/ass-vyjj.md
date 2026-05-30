---
id: ass-vyjj
status: closed
deps: []
links: []
created: 2026-05-30T03:15:03Z
type: task
priority: 1
assignee: ProbabilityEngineer
tags: [relocation, batch, buckets, store]
---
# Design repo/bucket batch relocation model

Extend the canonical store design for relocating all sessions associated with a repo/cwd bucket when a repository moves. Model batch relocation operations, per-session copy edges, source/destination bucket paths, and provenance while keeping raw session files immutable.

## Acceptance Criteria

Design documentation covers batch relocation records, per-session edges, cwd/bucket identity, idempotency, conflict handling, and interaction with pi-relocate. It accounts for repos with multiple sessions.

