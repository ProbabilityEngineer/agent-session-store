---
id: ass-vxdf
status: closed
deps: []
links: []
created: 2026-05-30T03:33:15Z
type: task
priority: 1
assignee: ProbabilityEngineer
tags: [inventory, reconciliation, buckets, aliases]
---
# Reconcile session buckets with cwd, aliases, and filesystem status

Refine the session bucket inventory into a reconciliation report that distinguishes active paths, moved/renamed candidates, deleted/deprecated candidates, decode-ambiguous buckets, and external imports. Use session JSONL cwd metadata, manifest cwd fields, lineage overlay aliases/session-labels, filesystem existence, and same-basename search candidates. Default missing buckets to missing-unclassified unless evidence supports a stronger status.

## Acceptance Criteria

npm run inventory-buckets writes session-bucket-reconciliation.md/json with status/confidence/reasons per bucket; cwd metadata is extracted from session rows; aliases/session-labels/manifest cwd are considered; wording avoids declaring deleted/deprecated without curated evidence; npm run lint passes.

