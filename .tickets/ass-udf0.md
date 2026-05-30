---
id: ass-udf0
status: closed
deps: []
links: []
created: 2026-05-30T03:15:22Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [summaries, checkpoints, threads, privacy]
---
# Add derived checkpoint/summary artifacts

Support derived checkpoint or summary artifacts for logical threads so finite-context continuation can use curated summaries without merging raw sessions. Artifacts should have provenance, timestamps, input session/member references, hashes, and privacy policy.

## Acceptance Criteria

Store design includes checkpoint/summary artifact records linked to logical threads or sessions; no raw transcript content is stored by default unless explicitly curated; reports list available checkpoints and their provenance.

