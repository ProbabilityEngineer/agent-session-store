---
id: ass-github-origin-rename-identity
status: open
deps: [ass-repo-identity-scan-write]
links: []
created: 2026-05-31T06:00:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Use GitHub origin rename evidence for repo identity continuity

Detect repo identity continuity when a local repo path changes but the GitHub origin has been renamed/moved, or when two paths point to related origin URLs over time.

## Acceptance Criteria

- Normalize GitHub origin URLs across SSH/HTTPS forms.
- Record origin owner/name as repo observation evidence.
- Detect renamed origin evidence when previous and current origins have matching repository identity signals, where available.
- Add repo events such as `rename`, `move`, or `alias` with provenance from git origin observations.
- Keep ambiguous cases as manual-review candidates, not authoritative facts.
- Do not require GitHub API by default; support optional API enrichment later if credentials are available.
- TypeScript check passes.
