---
id: ass-cli-productization
status: closed
deps: []
links: []
created: 2026-05-31T15:10:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Productize agent-session-store as a CLI

Turn the canonical store tooling into a usable provider-neutral CLI for indexing, importing, verifying, reporting, and exporting agent session data.

## Acceptance Criteria

- Add a documented CLI entrypoint, e.g. `agent-session-store`.
- Commands cover build/import, provider scans, graph export, repo identity scan/report, verification, and prune/readiness reports.
- Keep raw logs immutable by default.
- Use config/env for source roots instead of hardcoded personal paths.
- Package metadata supports local/global install.
- README includes quickstart and examples.

## Boundary note

The CLI should own canonical data preparation/export commands. Visualization commands may live in `pi-session-graph`; this package should expose graph-ready data contracts rather than HTML/SVG rendering.


## Closure

Added a documented `agent-session-store` bin entrypoint that wraps existing scripts for build, graph export, repo scan/report, inventory, temporal lineage, logical threads, and verification-style reports.
