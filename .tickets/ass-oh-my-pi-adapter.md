---
id: ass-oh-my-pi-adapter
status: open
deps: []
links: []
created: 2026-05-31T06:25:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Import oh-my-pi session JSONLs as first-class provider observations

Add an import adapter for oh-my-pi fork sessions under downloaded coding session archives. The format is Pi-like JSONL but must remain a distinct provider.

## Sample

`/Users/sam/Downloads/coding-sessions/omp/agent/sessions/-Documents-GitHub-bespoke-thinking/2026-02-21T22-05-09-713Z_1477dc61344fe8c0.jsonl`

First row example:

```json
{"type":"session","version":3,"id":"1477dc61344fe8c0","timestamp":"2026-02-21T22:05:09.713Z","cwd":"/Users/sam/Documents/GitHub/bespoke-thinking","title":"File edit system capability check"}
```

## Acceptance Criteria

- Scan configurable oh-my-pi roots, including `/Users/sam/Downloads/coding-sessions/omp/agent/sessions` when present.
- Import sessions with provider `oh-my-pi`, not `pi`.
- Parse provider session id from the `type=session` row (`id`) and fall back to filename short hex when needed.
- Parse start timestamp, cwd, and title/display label from the session row.
- Preserve metadata-only facts: line count, byte count, content hash, first/last event timestamps, event type counts, cwd, title.
- Do not store raw transcript text by default.
- Handle oh-my-pi bucket names like `-Documents-GitHub-bespoke-thinking` without assuming Pi bucket format.
- Include imported sessions in SQLite and JSON exports.
- Update docs/import-adapters.md from TBD to implemented behavior.
- TypeScript check passes.
