---
id: ass-xx2g
status: open
deps: []
links: []
created: 2026-05-30T02:53:44Z
type: task
priority: 2
assignee: ProbabilityEngineer
tags: [backups, verification, report]
---
# Add backup deletion readiness report

Create a verification/report command that summarizes which facts were extracted from local backup folders and whether it is safe to delete or archive the extracted backup directories. The report should list remaining raw backup path dependencies and any evidence gaps.

## Acceptance Criteria

A report under ~/.pi/agent/session-store/ or ~/.pi/agent/session-graph/ lists backup-derived sessions, observations, labels, presence/absence windows, hashes, and unresolved dependencies; it clearly says whether local backup folders are still needed; npm run lint passes.

