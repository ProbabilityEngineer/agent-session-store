---
id: ass-i9o3
status: closed
deps: []
links: []
created: 2026-06-05T01:15:30Z
type: task
priority: 2
assignee: ProbabilityEngineer
tags: [repo-identity, aliases, curation]
---
# Curate repo identity aliases for renamed tooling projects

Add/verify curated repo identity aliases discovered during graph review: pi-jj-vcs should be canonicalized to pi-jj-git-align; keep pi-jj-status separate unless explicitly approved. Ensure sidecar records are durable and exported consistently after rebuilds.

## Acceptance Criteria

repo-identities.jsonl includes approved pi-jj-vcs -> pi-jj-git-align alias with manual provenance; rebuild/export attaches pi-jj-vcs sessions to pi-jj-git-align repoIdentityId/displayName; candidate report no longer suggests the approved alias as unresolved; pi-jj-status remains separate.

