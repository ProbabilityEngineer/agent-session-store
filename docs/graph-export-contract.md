# Graph Export Contract

`agent-session-store` owns canonical session data and exports graph-ready projections for renderers such as `pi-session-graph`.

Renderers should consume this contract and should not parse raw transcripts, infer repo identity, derive continuity, or inspect provider-native archives directly.

## Current files

```text
~/.pi/agent/session-store/graph-export.json
~/.pi/agent/session-graph/curated-store.json
```

Both files currently contain the same JSON payload for compatibility.

## Top-level shape

```json
{
  "generatedAt": "2026-06-01T00:00:00.000Z",
  "source": "~/.pi/agent/session-store/session-store.sqlite",
  "graphFilters": {
    "excludedNoiseSessions": 76,
    "policy": "..."
  },
  "sessions": [],
  "edges": [],
  "labels": [],
  "classifications": [],
  "logicalThreads": [],
  "threadMembers": [],
  "threadEdges": [],
  "threadResumeTargets": [],
  "repoIdentities": [],
  "repoObservations": [],
  "repoEvents": [],
  "workBursts": [],
  "temporalActivitySpans": [],
  "activityMetrics": []
}
```

## Sessions

Sessions are canonical observations of provider-native session records.

Important fields:

- `id`: canonical store session id.
- `provider`: `pi`, `codex`, `oh-my-pi`, `claude`, `opencode`, etc.
- `providerSessionId`: provider-native id when available.
- `canonicalKey`: stable path/key for display/rendering.
- `startTimestamp` / `endTimestamp`: best known activity window.
- `lineCount` / `byteCount`: privacy-preserving size/count signal.
- `metadata.cwd`: observed cwd/workspace/project path.
- `metadata.displayName`: title/display label when available.
- `metadata.eventCounts`: provider-specific event/message/tool counts.
- `metadata.repoIdentityId`: stable repo identity when known.
- `metadata.activitySummary`: derived tool/event count summary when available.

## Edges

Edges represent canonical continuity or relationship facts.

Common fields:

- `id`
- `sourceSessionId`
- `targetSessionId`
- `edgeType`
- `timestamp`
- `confidence`
- `provenance`
- `metadata`

Known edge types include:

- `relocation`
- `branch`
- `same_cwd_temporal`
- `same_repo_identity_temporal`
- future: `compaction`, `summary_continuation`, `resume_fork_missing_cwd`

Renderers should display `confidence` and `provenance` and allow filtering by edge type.

## Labels and classifications

Labels are display aids attached to sessions/edges/repos. Classifications describe semantic edge/session classes.

Renderers may use these for labels, legends, and filtering, but should treat them as store-provided facts with confidence/provenance.

## Repo identity

Repo identity records separate stable repo/project identity from cwd/path/bucket observations.

- `repoIdentities`: stable project/repo records.
- `repoObservations`: path/bucket/remote evidence for a repo identity.
- `repoEvents`: rename/move/swap/fork/archive/alias events.

Renderers should group by repo identity when available and fall back to cwd labels otherwise.

## Work bursts

`workBursts` are derived temporal clusters, usually by repo identity or cwd.

Example:

```json
{
  "id": "artifact_...",
  "kind": "temporal_work_burst",
  "repoIdentityId": "repo_...",
  "sessionIds": ["session_1", "session_2"],
  "providers": ["pi", "codex"],
  "start": "2026-05-31T10:00:00Z",
  "end": "2026-05-31T12:00:00Z",
  "sessionCount": 2,
  "provenance": "scripts/build-curated-store.ts",
  "confidence": "derived"
}
```

They are derived metadata only. Raw sessions are not merged.

## Temporal activity spans

`temporalActivitySpans` are renderer-ready activity windows for timelines.

Example:

```json
{
  "id": "span_session_...",
  "sessionId": "session_...",
  "provider": "pi",
  "repoIdentityId": "repo_...",
  "cwd": "/Users/sam/git/agents/pi-session-graph",
  "label": "pi-session-graph",
  "start": "2026-05-31T10:00:00Z",
  "end": "2026-05-31T11:00:00Z",
  "lineCount": 120,
  "eventCount": 42,
  "toolCount": 7,
  "activityScore": 49,
  "confidence": "derived",
  "provenance": "session-metadata"
}
```

Renderers may compute compressed axes from these spans. The store does not render SVG/HTML.

## Activity metrics

`activityMetrics` are privacy-preserving aggregates for effort/accrual views.

Dimensions may include:

- provider
- repo identity/cwd
- logical thread
- work burst
- time window

Metrics may include:

- session count
- event/message/turn count where known
- tool count where known
- token count where provider metadata supports it
- line/byte counts as weak activity proxies
- activity score with missing-data notes

Renderers must distinguish wall-clock span from accrued activity.

## Compatibility

Renderers should continue to support the existing session/edge/label/classification fields. New arrays are additive and may be absent in older exports.
