---
id: ass-session-move-namespaced-manifests
status: closed
deps: []
links: []
created: 2026-06-01T00:00:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
tags: [paths, migration, session-move]
---
# Import session-move namespaced manifest paths

`agent-session-store` should import both legacy top-level relocation evidence and new `pi-session-move` namespaced manifest paths.

## Design

Read and merge relocation records from:

```text
~/.pi/agent/relocations.jsonl
~/.pi/agent/session-move/manifests/relocations.jsonl
```

If lineage metadata becomes store input, read both:

```text
~/.pi/agent/relocation-lineages.jsonl
~/.pi/agent/session-move/manifests/relocation-lineages.jsonl
```

Preserve source path/provenance in source/input metadata. Do not mutate raw evidence.

## Acceptance Criteria

- `build-store` imports records from both legacy and new manifest locations.
- Duplicate records across paths are deduped or handled idempotently.
- Inputs/sources record all manifest paths used.
- Old `pi-relocate` and new `pi-session-move` tool/provenance values are tolerated.
- `npm run lint` and `npm run build-store` pass.
