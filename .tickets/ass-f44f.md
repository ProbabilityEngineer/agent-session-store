---
id: ass-f44f
status: closed
deps: []
links: []
created: 2026-05-30T03:14:58Z
type: task
priority: 1
assignee: ProbabilityEngineer
tags: [inventory, buckets, oh-my-pi, imports]
---
# Inventory session buckets and deprecated repo paths

Cross-reference Pi session buckets under ~/.pi/agent/sessions with the filesystem to identify cwd/repo buckets whose directories are missing, moved, deprecated, or likely archived. Also scan /Users/sam/Downloads/coding-sessions for oh-my-pi and other session stores, including /Users/sam/Downloads/coding-sessions/oh-my-pi-sessions and /Users/sam/Downloads/coding-sessions/omp/agent/sessions. Do not mutate or delete session files.

## Acceptance Criteria

A report lists live Pi buckets, decoded path guesses, existence/deprecation status, session counts, earliest/latest timestamps, and discovered external session roots under Downloads/coding-sessions. Findings are imported as metadata/evidence into the canonical store or staged for import. No raw sessions are modified.

