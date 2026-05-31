---
id: ass-repo-identity-curation
status: open
deps: [ass-repo-identity-model]
links: []
created: 2026-05-31T05:30:00Z
type: task
priority: 1
assignee: ProbabilityEngineer
---
# Add curated repo identity sidecar/importer

Provide a curated sidecar format for human-declared repo identity aliases/events, including project swaps like `bespoke-thinking-website` and `bespoke-thinking-website-02`.

## Acceptance Criteria

- Define a JSONL sidecar format for repo identity declarations/events.
- Import sidecar into canonical SQLite/JSON store.
- Support path ranges and event timestamps when known.
- Support unknown/approximate timestamps with manual review required.
- Include examples for `bespoke-thinking-website` and `bespoke-thinking-website-02` swap/alias events without asserting unverified facts.
- Do not rewrite raw session JSONLs or relocation manifest.
