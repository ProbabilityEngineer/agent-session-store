---
id: ass-github-api-repo-enrichment
status: closed
deps: [ass-github-origin-rename-identity]
links: []
created: 2026-05-31T06:10:00Z
type: feature
priority: 3
assignee: ProbabilityEngineer
---
# Optional GitHub API repo identity enrichment

Optionally enrich repo identity observations using GitHub API when credentials are available. This is separate from local origin scanning so the core workflow works offline and without tokens.

## Acceptance Criteria

- Detect GitHub token from standard environment/config only when present.
- Query canonical repository metadata for normalized GitHub origins.
- Record stable GitHub `id` / `node_id`, canonical `full_name`, `html_url`, `created_at`, `pushed_at`, `archived`, `fork`, and parent/source when available.
- Confirm rename/move continuity when old and new origin names resolve to the same GitHub repo id/node_id.
- Store API facts as evidence/observations with provenance and timestamps.
- Never require API access for `npm run build-store` to succeed.
