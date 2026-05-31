---
id: ass-repo-identity-continuity
status: open
deps: []
links: []
created: 2026-05-31T16:00:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Derive session continuity by repo identity

Use repo identity observations to connect sessions across cwd/path/bucket changes and across providers.

## Acceptance Criteria

- Map session cwd/bucket/path evidence to repo identity when possible.
- Add low/medium confidence edges or thread grouping for sessions sharing repo identity and close temporal windows.
- Prefer repo identity continuity over literal cwd continuity when both exist.
- Preserve provenance/confidence metadata explaining derivation.
- Avoid connecting unrelated sessions solely because they share a broad parent directory.
