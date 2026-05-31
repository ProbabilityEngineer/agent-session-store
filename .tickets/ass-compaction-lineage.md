---
id: ass-compaction-lineage
status: open
type: feature
priority: 2
created: 2026-05-31T20:05:00Z
---
# Import Pi compaction lineage and counts

Pi records or reports compaction state somewhere in session metadata/UI (example observed: `/compact` reported the session had been compacted 6 times). The canonical session store should discover and model this instead of treating compacted continuations as unrelated sessions.

## Acceptance Criteria

- Identify where Pi stores compaction metadata/counts in session files or sidecars.
- Add extractor/import logic for compaction facts without mutating raw session JSONL.
- Model compaction as explicit lineage/evidence, e.g. edge type `compaction` or `summary_continuation`.
- Preserve compaction count on session metadata when available.
- Include provenance/confidence fields for compaction-derived edges.
- Add regression fixture or documented sample for a session with multiple compactions.
- Rebuild `session-store.export.json` and `graph-export.json` with compaction metadata/edges.

## Notes

Observed user-visible clue: Pi said the session had been compacted 6 times after `/compact`. Search raw Pi session events and any session metadata sidecars for fields/messages related to compaction, summarization, or continuation.
