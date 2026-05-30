---
id: ass-l6ic
status: closed
deps: []
links: []
created: 2026-05-30T03:15:10Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [store, retention, relocation]
---
# Add superseded/deletion-candidate marks for old observations

Add canonical store support for marking old session observations as superseded, archived, or deletion-candidate after repo/bucket relocation without deleting raw files. Marks should include reason, replacement observation/session, source tool, timestamp, confidence, and manual-review requirement.

## Acceptance Criteria

Schema/design and store export support observation marks; batch relocation design uses marks for old bucket sessions; reports can list deletion candidates separately from active observations; no files are deleted automatically.

