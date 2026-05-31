---
id: ass-claude-adapter
status: open
deps: []
links: []
created: 2026-05-31T06:50:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Import Claude coding session archives

Add a metadata-only adapter for Claude session data found under `/Users/sam/Downloads/coding-sessions/claude` and organized iCloud copies.

## Observed structure

- `transcripts/*.jsonl` — direct transcript/event JSONL files with timestamps and tool events.
- `projects/<project-bucket>/<session-id>/...` — per-session/project artifacts, subagents, tool-results.
- `tasks/<uuid>/...` — task artifacts.
- `plans/*.md`, `todos`, `history.jsonl`, shell snapshots and file-history may be evidence/artifacts.
- `plugins`, `cache`, `debug`, telemetry/stats are review/delete candidates unless needed as evidence.

## Acceptance Criteria

- Import provider as `claude`.
- Scan configurable Claude roots.
- Parse transcript session ids from filenames and/or JSONL contents.
- Extract metadata-only facts: path, line/byte/hash, first/last timestamps, cwd/project path when available, event type/tool counts.
- Import project/session artifact directories as artifacts/evidence linked to session id where possible.
- Do not store raw transcript text by default.
- Classify plugin/cache/debug/telemetry areas as non-session review candidates, not sessions.
- Update docs/import-adapters.md.
- TypeScript check passes.
