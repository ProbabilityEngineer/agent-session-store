---
id: ass-temporal-axis-data
status: closed
deps: [ass-graph-export-contract]
links:
  - ../pi-session-graph/.tickets/psg-canonical-temporal-html.md
  - ../pi-session-graph/.tickets/psg-temporal-compressed-time.md
created: 2026-06-01T14:35:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Export canonical temporal activity spans

Export temporal data needed by graph renderers without embedding presentation details.

## Acceptance Criteria

- Export session spans with start/end timestamps, provider, repo identity/cwd labels, logical thread/work burst IDs, and confidence/provenance.
- Export inactive gap candidates or enough sorted activity spans for renderers to compute compressed axes.
- Export temporal work burst records derived from canonical sessions/repo identity.
- Do not generate SVG/HTML here; rendering belongs in `pi-session-graph`.
- Do not parse raw transcript content for visual-only needs.


## Closure

Exported renderer-ready `temporalActivitySpans` derived from canonical session metadata and `workBursts` from temporal work-burst artifacts. Renderers can compute compressed time axes from these prepared spans.
