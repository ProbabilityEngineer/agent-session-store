---
id: ass-wlpa
status: closed
deps: []
links: []
created: 2026-05-30T02:53:39Z
type: task
priority: 1
assignee: ProbabilityEngineer
tags: [backups, extraction, store, evidence]
---
# Extract backup session facts into canonical store

Add/import backup-derived facts into the canonical store before deleting local extracted backup folders. Preserve backup session observations, cwd labels, session ids, snapshot labels, present/absent windows, mtimes/birthtimes, line counts, sizes, hashes, and provenance/confidence without storing raw transcript content.

## Acceptance Criteria

Backup-derived records in SQLite/JSON include all currently known main root, manual relocation experiment, profile/context jump, and quicklook evidence; extraction can be rerun without duplicates; backup directories are not required for graph/report generation after extraction.

