---
id: ass-session-suite-naming-plan
status: open
deps: []
links: []
created: 2026-05-31T15:10:00Z
type: task
priority: 2
assignee: ProbabilityEngineer
---
# Plan pi-session suite naming migration

Document and execute gradual naming alignment for related Pi session tools.

## Proposed suite

- `agent-session-store` — provider-neutral CLI/core
- `pi-session-store` — Pi-facing store wrapper
- `pi-session-relocate` — session relocation/continuation extension
- `pi-session-repo-move` — actual repo move extension
- `pi-session-graph` — viewer/graph extension

## Acceptance Criteria

- Decide which repos are renamed vs wrapped/aliased.
- Preserve old package names with compatibility docs/redirects.
- Update READMEs and install docs.
- Avoid breaking existing Pi settings abruptly.

## Boundary note

`agent-session-store` remains the provider-neutral core. `pi-session-store` should be the Pi-facing wrapper. `pi-session-graph` should render prepared exports. `pi-session-relocate` records session relocation/fork facts; `pi-session-repo-move` handles filesystem repo moves.

## Slash command policy

The suite should reduce top-level command clutter by using namespaced commands:

```text
/session-store ...
/session-graph ...
/session-relocate ...
/session-repo ...
```

Existing legacy commands can remain aliases during migration, but docs should present the namespaced form first.
