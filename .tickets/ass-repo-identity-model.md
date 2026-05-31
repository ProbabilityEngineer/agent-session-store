---
id: ass-repo-identity-model
status: closed
deps: []
links: []
created: 2026-05-31T05:30:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Add durable repo identity model

Model repo/project identity independently from paths so renamed, swapped, archived, forked, or moved repos can be understood across time.

## Motivation

Paths such as `bespoke-thinking-website` and `bespoke-thinking-website-02` can swap meaning over time. The store should preserve path observations as evidence while allowing a stable logical repo/project identity for time-use and relationship analysis.

## Acceptance Criteria

- Add canonical schema/export objects for repo identities, repo observations, and repo events.
- Repo identity is distinct from path/cwd/bucket.
- Repo observations can attach identity to path/bucket/git remote over a timestamp/range.
- Repo events support at least `rename`, `move`, `swap`, `fork`, `archive`, `superseded_by`, and `alias`.
- Events include provenance/evidence/confidence/manual-review fields.
- Existing path-based session observations remain unchanged and immutable.
- JSON export and SQLite schema include the new records.
