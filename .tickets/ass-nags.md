---
id: ass-nags
status: open
deps: []
links: []
created: 2026-06-03T03:27:11Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [active-hours, metrics, timestamps, reports]
---
# Compute active project hours from event timestamps

Add active-time reconstruction by grouping timestamped events into work blocks per project/repo/session/agent. Sum gaps under configurable idle thresholds (e.g. 5, 15, 30, 60 minutes) to estimate activeMinutes/activeHours, workBlockCount, firstWorkedAt, lastWorkedAt, and confidence/coverage. This should replace misleading span/compaction/line-count proxies for time spent on projects.

## Acceptance Criteria

SQLite/export includes active time metrics per repo/project, provider, agent/lineage, and session where possible; idle threshold is recorded; reports distinguish calendar span from active time; low timestamp coverage is flagged; no raw transcript content is required.

