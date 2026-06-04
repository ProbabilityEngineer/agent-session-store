---
id: ass-qdoy
status: open
deps: []
links: []
created: 2026-06-03T03:30:31Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [dedupe, canonical-identity, imports, metrics]
---
# Detect duplicate and equivalent sessions across exports

Detect duplicate/equivalent sessions across raw JSONL, markdown exports, HTML exports, backups, copied buckets, and provider-specific stores. Use content hashes, normalized event hashes, provider IDs, timestamps, titles, cwd/repo identity, and similarity heuristics to avoid double-counting active hours or session counts.

## Acceptance Criteria

Duplicate candidates are recorded with confidence/provenance; canonical session identity can link multiple observations/exports of the same conversation; active-hours and graph metrics avoid double-counting high-confidence duplicates; ambiguous duplicates appear in validation report.

