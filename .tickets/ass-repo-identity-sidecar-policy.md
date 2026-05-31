---
id: ass-repo-identity-sidecar-policy
status: closed
deps: [ass-repo-identity-model]
links: []
created: 2026-05-31T06:00:00Z
type: task
priority: 2
assignee: ProbabilityEngineer
---
# Clarify repo identity sidecar vs DB projection policy

Document and enforce that repo identity facts/events are written to reviewable sidecars first, then imported into SQLite/JSON. SQLite should not be the only place where identity changes exist.

## Acceptance Criteria

- Docs explain raw evidence, sidecar inputs, and DB projection roles.
- Any automatic writer avoids mutating raw session JSONLs and relocation manifest.
- Sidecar records include provenance, confidence, timestamps, and manual-review flags.
- Build-store can rebuild DB identity tables from sidecars.
