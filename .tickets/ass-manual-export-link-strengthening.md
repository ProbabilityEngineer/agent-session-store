---
id: ass-manual-export-link-strengthening
status: closed
deps: []
links: []
created: 2026-05-31T16:00:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Strengthen manual export artifact links

Improve linking between Markdown/HTML manual exports and provider-native sessions without creating duplicate sessions.

## Acceptance Criteria

- Read organized archive manifests for duplicate/manual export matches.
- Link artifacts to native session IDs when evidence is deterministic.
- Record uncertain links as manual-review evidence.
- Keep manual exports modeled as artifacts/evidence, not sessions.
