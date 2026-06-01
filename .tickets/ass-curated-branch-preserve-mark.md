---
id: ass-curated-branch-preserve-mark
status: closed
deps: []
links:
  - ../pi-session-graph/.tickets/psg-compaction-edges.md
created: 2026-06-01T14:55:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
---
# Add curated branch/preserve marks for superseded sessions

Relocation move semantics can mark an older session observation as `superseded` and `deletion_candidate`, but a user may intentionally keep that copy as a meaningful branch. Support a curated sidecar mark that preserves such sessions and labels the branch.

## Motivation

A pi-session-graph session was relocated onward to agent-session-store and marked deletion-candidate by move semantics, but the user wants the older pi-session-graph copy preserved as the `Ariadne branch` because it retained identity/continuity context that the later continuation lost.

## Acceptance Criteria

- Define a manual sidecar record to mark a session observation/file as `preserve` / `intentional_branch`.
- Allow a human-readable branch label such as `Ariadne branch`.
- Store import/rebuild applies the preserve mark without mutating raw session JSONLs or raw relocation manifests.
- Reports and graph exports show preserved branch labels and suppress or downgrade deletion-candidate warnings for preserved sessions.
- Preserve marks include timestamp, reason, provenance, confidence, and target session path/id.
- Prune/readiness reports skip preserved sessions unless explicitly forced.


## Closure

Implemented `~/.pi/agent/session-store/observation-marks.jsonl` manual sidecar import for curated observation marks including `preserve` / `intentional_branch`, labels such as `Ariadne branch`, reason/timestamp/provenance/confidence, and target path/session/observation IDs. Build-store imports preserve marks without mutating raw session JSONLs or relocation manifests, applies preserved leaves as active resume targets instead of recoverable deletion candidates, and graph export now includes `observationMarks` plus `preservedBranches`. Documented sidecar format in `docs/canonical-store.md`. Validated with `npm run lint`, `npm run build-store`, and `npm run export-graph`.
