---
id: ass-temporal-work-bursts
status: closed
deps: [ass-repo-identity-continuity]
links: []
created: 2026-05-31T16:00:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Derive temporal work bursts

Cluster sessions into work bursts by repo identity/cwd and nearby timestamps so graph views can show higher-level episodes.

## Acceptance Criteria

- Create deterministic work-burst records from sessions grouped by repo identity or cwd and time window.
- Include provider/session counts, start/end timestamps, and representative labels.
- Export work bursts for graph consumers.
- Do not merge raw transcripts; bursts are derived metadata only.
