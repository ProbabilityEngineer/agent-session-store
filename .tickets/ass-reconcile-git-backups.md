---
id: ass-reconcile-git-backups
status: closed
deps: []
links: []
created: 2026-05-30T04:43:49Z
type: task
priority: 1
assignee: ProbabilityEngineer
tags: [inventory, reconciliation, backups, repos]
---
# Reconcile sessions against /Users/sam/git and backup roots

Scan /Users/sam/git for current repositories and compare against session buckets discovered in ~/.pi/agent/sessions, /Users/sam/Downloads/session-backups, and /Users/sam/Downloads/coding-sessions. Improve moved/renamed/missing inference using session cwd metadata and same-basename/current-repo candidates, then update canonical DB/export with inferred bucket statuses. Do not delete or mutate session backups.

## Acceptance Criteria

inventory-buckets scans /Users/sam/git broadly and session roots under session-backups/coding-sessions; generated reconciliation identifies active, external, moved/renamed candidate, and missing-unclassified buckets with reasons; build-store imports statuses to SQLite/JSON; no backups or sessions are deleted; lint passes.

