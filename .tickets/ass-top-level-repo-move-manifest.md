---
id: ass-top-level-repo-move-manifest
status: closed
type: feature
priority: 1
created: 2026-06-01T00:00:00Z
---
# Import top-level pi-repo-move repo move manifest fields

`pi-repo-move` emits relocation manifest records with first-class repo move fields:

```json
{
  "operationType": "repo_move",
  "tool": "pi-repo-move",
  "sourceRepo": "/old/repo",
  "targetRepo": "/new/repo"
}
```

## Acceptance Criteria

- Extend relocation manifest record parsing to accept top-level `operationType`, `tool`, `sourceRepo`, and `targetRepo`.
- Preserve compatibility with historical records that only have `fromCwd` / `toCwd` or nested metadata.
- Import `operationType: repo_move` as a first-class repo event, not only a session relocation edge.
- Export repo move events in `graph-export.json` for `pi-session-graph`.
- Avoid mutating `~/.pi/agent/relocations.jsonl`.
