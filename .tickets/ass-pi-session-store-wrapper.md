---
id: ass-pi-session-store-wrapper
status: open
deps: [ass-cli-productization]
links:
  - ../pi-session-store
created: 2026-05-31T15:10:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Create Pi-facing pi-session-store wrapper extension

Expose common `agent-session-store` workflows inside Pi under the suite naming convention.

## Acceptance Criteria

- New/companion package `pi-session-store` exists.
- Provides lightweight slash commands for store status, rebuild/export, repo scan, provider import summary, and reports.
- Calls CLI/scripts rather than duplicating heavy import logic.
- Documents relationship: provider-neutral core is `agent-session-store`; Pi UX wrapper is `pi-session-store`.
