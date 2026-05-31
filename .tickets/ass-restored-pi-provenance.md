---
id: ass-restored-pi-provenance
status: closed
deps: []
links: []
created: 2026-05-31T16:00:00Z
type: feature
priority: 3
assignee: ProbabilityEngineer
---
# Mark restored Pi session provenance

Track sessions restored from Trash/backups or copied into `~/.pi/agent/sessions` so graph/report users understand provenance.

## Acceptance Criteria

- Detect available evidence for restored/copied Pi sessions from backup manifests, file metadata, or curated sidecars.
- Add observation marks/classifications for restored sessions.
- Never mutate raw Pi session JSONLs.
- Reports distinguish live-native observations from restored/imported observations.
