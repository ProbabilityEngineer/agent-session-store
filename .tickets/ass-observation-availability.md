---
id: ass-observation-availability
status: open
deps: []
links: []
created: 2026-05-30T04:00:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Add observation availability and supersession records

Add canonical store support for marking session observations as active, unavailable, superseded, recoverable, branch-source, archived, or deletion-candidate. Normal relocation move semantics should mark the source observation unavailable/superseded with a replacement observation, while branch/copy semantics keep both active.

## Acceptance Criteria

- SQLite/JSON store includes observation availability/marks with timestamp, reason, source tool, confidence, replacement observation/session, and manual-review flag.
- Existing relocation edges can derive unavailable/superseded marks for moved sources.
- Reports can list active leaves vs recoverable moved sessions.
- No raw session files are deleted or modified.
- npm run lint passes.
