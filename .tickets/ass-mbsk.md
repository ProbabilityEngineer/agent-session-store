---
id: ass-mbsk
status: open
deps: []
links: []
created: 2026-06-03T03:30:10Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [timestamps, confidence, metrics, providers]
---
# Normalize timestamps and record coverage confidence

Normalize timestamp formats across Pi, Codex, Claude, OpenCode, Factory, RovoDev, OMP, and Late imports. Record timestamp coverage and confidence at event/session/visit levels: timestampedRows, totalRows, firstEventAt/lastEventAt source, timezone assumptions, clock/order anomalies, and whether active-time/visit-row metrics are reliable.

## Acceptance Criteria

Importer/indexer records normalized timestamps where available; exports include timestamp coverage/confidence fields; validation report flags low coverage and anomalies; active-hours and visit-row metrics consume these confidence fields.

