---
id: ass-pi-session-store-wrapper
status: closed
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
- Provides one lightweight namespaced slash command, e.g. `/session-store ...`, with subcommands for status, rebuild/export, repo scan, provider import summary, and reports.
- Calls CLI/scripts rather than duplicating heavy import logic.
- Documents relationship: provider-neutral core is `agent-session-store`; Pi UX wrapper is `pi-session-store`.

## Slash command policy

Avoid many top-level store slash commands. Prefer one namespace:

```text
/session-store status
/session-store rebuild
/session-store export-graph
/session-store repo-identities
/session-store reports
```

Heavy data work should call the `agent-session-store` CLI/scripts underneath rather than duplicating logic in the Pi extension.


## Closure

Bootstrapped companion `/Users/sam/git/agents/pi-session-store` package with `/session-store ...` command wrapper over the `agent-session-store` CLI. Added `agent-session-store status` to support wrapper status output. The wrapper delegates build/export/repo/report workflows to core scripts and documents the namespace/boundary. Validated `npm run lint` in both repos.
