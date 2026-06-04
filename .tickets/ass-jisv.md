---
id: ass-jisv
status: closed
deps: []
links: []
created: 2026-06-03T03:30:15Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [repo-identity, normalization, providers, metrics]
---
# Resolve repo and project identities across providers

Normalize cwd/project labels across all providers and path variants using cwd paths, session bucket names, git remotes, repo identity sidecars, aliases, and case/path cleanup. Ensure equivalent projects like basename-only labels and absolute paths collapse to a canonical repo/project identity for active-hours and graph reports.

## Acceptance Criteria

Canonical repo/project identity is assigned where evidence supports it; common path variants (/users/sam, /Users/sam/users/sam, bucket-derived names, basename-only labels) are normalized; repo identity confidence/provenance is exported; ambiguous projects remain separate with warnings rather than being silently merged.

