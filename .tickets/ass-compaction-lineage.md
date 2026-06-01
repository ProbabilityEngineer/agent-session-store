---
id: ass-compaction-lineage
status: closed
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


## Closure

Implemented metadata-only Pi compaction import from session JSONL records in `scripts/build-curated-store.ts`. The store now detects explicit `type: compaction` summary records and `message.details.rtkCompaction`, stores counts/timestamps/sample line numbers/summary hashes without raw summaries, emits `compaction_summary` evidence and checkpoint artifacts, and `scripts/export-graph-json.ts` exports `compactionEvents`. Validated with `npm run lint`, `npm run build-store`, and `npm run export-graph`; current build produced 88 compaction evidence records and 88 graph compaction events.
