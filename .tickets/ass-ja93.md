---
id: ass-ja93
status: closed
deps: []
links: []
created: 2026-05-30T03:04:47Z
type: task
priority: 1
assignee: ProbabilityEngineer
tags: [verification, backups, store]
---
# Verify canonical store completeness before deleting backup extracts

Review the populated SQLite/JSON store and backup-readiness report to confirm backup-derived labels, observations, presence/absence windows, context-jump classifications, and old extension repository evidence are preserved. Do not delete backup folders.

## Acceptance Criteria

A verification report exists in docs or ~/.pi/agent/session-store/ summarizing counts, key preserved facts, remaining raw backup references, and explicit recommendation on whether extracted backup folders can be removed later. No backups are deleted.

