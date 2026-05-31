---
id: ass-repo-identity-scan-write
status: open
deps: [ass-repo-identity-model]
links: []
created: 2026-05-31T06:00:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Scan repos and write repo identity observations to sidecar and DB

Add an automatic repo scan that records durable repo observations in a reviewable sidecar and imports them into the canonical DB. The DB remains a projection; the sidecar is the durable curated/observed input.

## Acceptance Criteria

- Scan configured repo roots for Git/JJ repos.
- Record path, folder name, VCS type, git origin URL, first/last commit where available, and observed timestamp.
- Write observations to `~/.pi/agent/session-store/repo-identities.jsonl` or a dedicated observed sidecar such as `repo-observations.jsonl` without duplicating identical observations.
- Import scan records into `repo_observations` during `npm run build-store`.
- Automatic observations use source/confidence like `repo-scan` / `observed` and do not assert semantic identity swaps without evidence.
- TypeScript check passes.
