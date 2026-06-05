---
id: ass-4cs1
status: in_progress
deps: []
links: []
created: 2026-06-05T01:15:17Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [active-hours, imports, coverage, external-providers, undercount]
---
# Recover active time from external and archived project histories

Improve active-time coverage for projects whose historical work is undercounted because imported external/archive sessions lack usable event timestamp indexing. Known example: check-your-photos-v1 currently reports ~27h despite user-confirmed hundreds of hours across cypv1/checkyourphotosv1/check-your-photos-v1/CRPv1/check-raw-photos. Need import/index support or explicit confidence reporting for missing historical effort.

## Acceptance Criteria

Provider imports expose enough event/timestamp metadata to estimate active time where available; build validation reports per-project timestamp coverage and undercount risk; check-your-photos-v1 aliases are aggregated with clear coverage/confidence; if exact active time cannot be derived, export includes an explicit incompleteCoverage/undercount warning rather than presenting the total as complete.


## Notes

**2026-06-05T01:21:25Z**

Partial progress: build-validation now reports active-time coverage warnings/exclusions, and graph export includes activeTimeMetrics.metadata coverageWarnings/excludedSessionIds/collapsedIntervals. This exposes undercount/coverage risk but does not yet recover hundreds of hours for check-your-photos-v1; that still requires indexing non-Pi/external provider event timestamps or importing more historical event evidence.
