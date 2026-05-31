---
id: ass-session-title-keywords
status: open
deps: []
links: []
created: 2026-05-31T16:00:00Z
type: feature
priority: 3
assignee: ProbabilityEngineer
---
# Extract title/task keywords for graph labels

Derive lightweight labels from session titles, summaries, and provider task metadata without reading/storing transcript body content.

## Acceptance Criteria

- Extract normalized keywords from observed titles/summaries only.
- Store as labels or metadata with source/provenance.
- Use keywords to improve graph/thread labels.
- No raw transcript body content is stored by default.
