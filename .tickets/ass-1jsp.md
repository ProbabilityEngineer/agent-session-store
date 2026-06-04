---
id: ass-1jsp
status: open
deps: []
links: []
created: 2026-06-03T03:30:25Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [validation, reports, imports, metrics]
---
# Add build validation report for imports and metrics

Generate a validation report after agent-session-store build summarizing provider counts, imported/skipped/error files, timestamp coverage, active-hours confidence, visit-row metric coverage, duplicate suspicions, repo identity ambiguity, and graph/export completeness. This should make indexing failures visible before report rendering.

## Acceptance Criteria

Build emits or writes a validation report; report includes provider/session/event counts, skipped/error details, timestamp coverage, metric coverage, duplicate candidates, repo identity warnings, and links/IDs for follow-up; CI/manual validation can fail or warn based on severity.

