# agent-session-store

Canonical store and import/reconstruction tooling for agent session lineage, repository identity, evidence curation, and graph/report exports.

Repository shorthand:

```text
git:github.com/ProbabilityEngineer/agent-session-store
```

## Principles

- Do not mutate raw Pi session JSONLs.
- Do not rewrite legacy `~/.pi/agent/relocations.jsonl` or namespaced `~/.pi/agent/session-move/manifests/relocations.jsonl` raw manifests.
- Store metadata, hashes, timestamps, labels, counts, and evidence by default, not raw transcript content.
- Treat cwd/path/bucket as observations, not durable project identity.

## CLI

The package ships committed built JavaScript under `dist/`. The preferred npm/global executable is installed as:

```text
$(npm prefix -g)/bin/astore
```

Compatibility alias:

```text
$(npm prefix -g)/bin/agent-session-store
```

```bash
astore build
astore export-graph
astore scan-repos
astore repo-identities
astore repo-identity-candidates
astore approve-repo-identity --candidate <id> --yes
astore inventory-providers
astore backup-readiness
astore -V
# compatibility fallback still works:
agent-session-store build
```

The CLI runs the built `dist/scripts/*.js` commands and keeps canonical data preparation separate from graph rendering. `pi-session-graph` can depend on this package as its canonical store/export backend, while graph rendering remains in the graph package.

## Delayed install after pi-session-move

`pi-session-move` can be installed first and is sufficient to record raw move evidence. Later, `agent-session-store build` can rebuild the canonical SQLite/export state from namespaced move inputs:

```text
~/.pi/agent/session-move/manifests/relocations.jsonl
~/.pi/agent/session-move/manifests/relocation-lineages.jsonl
```

Legacy inputs are still read for compatibility:

```text
~/.pi/agent/relocations.jsonl
~/.pi/agent/relocation-lineages.jsonl
```

Required move-manifest fields are the source/destination session paths, source/destination cwd, timestamp, and move mode/operation metadata when available. `pi-session-move` writes those fields directly. A missing `~/.pi/agent/session-store/session-store.sqlite` is expected on first rebuild; `astore build` creates it and `astore export-graph` then writes `graph-export.json`.

## Main scripts

```bash
npm run build-store          # build SQLite + JSON exports
npm run export-graph         # graph-ready JSON for pi-session-graph
npm run repo-identities      # markdown report for repo identities/events
npm run repo-identity-candidates # candidate renamed/project alias report
npm run approve-repo-identity -- --candidate <id> --yes # append approved aliases
npm run inventory-providers # provider archive format inventory
npm run scan-repos           # append observed repo identity records to sidecar
npm run enrich-github-repos  # optional GitHub API enrichment when GITHUB_TOKEN/GH_TOKEN is set
npm run backup-readiness     # backup extraction readiness report
npm run inventory-buckets    # session bucket inventory/reconciliation
npm run logical-threads      # logical thread/resume target report
npm run reconstruct          # local history reconstruction
npm run validate-timeline    # timeline validation
npm run index-segments       # metadata-only session segment index
npm run prefix-lineage       # prefix/common-prefix lineage reconstruction
npm run build-graphs         # Mermaid graph reports: lineage-full, lineage-focused, timeline-projects, timeline-sessions
npm run lint                 # TypeScript check
```

## Generated artifacts

```text
~/.pi/agent/session-store/session-store.sqlite
~/.pi/agent/session-store/session-store.export.json
~/.pi/agent/session-store/graph-export.json
~/.pi/agent/session-store/repo-identities.md
~/.pi/agent/session-store/repo-identity-candidates.json
~/.pi/agent/session-store/repo-identity-candidates.md
~/.pi/agent/session-store/provider-format-inventory.json
~/.pi/agent/session-store/provider-format-inventory.md
~/.pi/agent/session-store/raw-source-manifest.json
~/.pi/agent/session-store/raw-source-manifest.md
~/.pi/agent/session-store/build-validation.md
~/.pi/agent/session-store/session-bucket-reconciliation.json
~/.pi/agent/session-store/session-bucket-reconciliation.md
~/.pi/agent/session-store/logical-threads.md
~/.pi/agent/session-graph/curated-store.json
```

SQLite is the canonical local database. JSON exports are portable/reviewable projections for graph viewers and disaster recovery.

The `events` table stores metadata-only event rows. It currently indexes Pi session JSONL events and timestamped JSONL archives from providers such as Codex, oh-my-pi, and Factory. Event rows include provider, event type, timestamp, ordinal/row number, role/tool metadata, byte offsets/counts, and content hashes, not raw transcript text.

Default external archive roots include:

```text
~/Downloads/coding-sessions
~/Desktop/developer-archive/x-backups-coding-sessions/keep-session-data
~/Desktop/developer-archive/x-backups/x-backups-coding-sessions/keep-session-data
~/Desktop/developer-archive/coding-sessions/keep-session-data
~/Library/Mobile Documents/com~apple~CloudDocs/developer/coding-sessions-organized-20260531T052907Z/keep-session-data
```

Override roots with `AGENT_SESSION_EXTERNAL_ROOTS=/path/a:/path/b`.

`npm run build-graphs` writes timestamped HTML graph reports under `~/Desktop/session-graphs/`. Data/debug artifacts (`.json`, `.mmd`, `.md`) are omitted by default; include them with `npm run build-graphs -- --include-data`.

| File pattern | Previous name | Meaning |
|---|---|---|
| `<timestamp>-lineage-full.html` | `temporal-lineage.html` | Full temporal lineage graph: all visible lineage edges plus connected/significant standalone session starts. |
| `<timestamp>-lineage-focused.html` | `temporal-lineage-focused.html` | Focused temporal lineage graph: sessions with one or more visible relocation/move/overlay edges; omits standalone starts. |
| `<timestamp>-timeline-projects.html` | `temporal-timeline.html` | Timeline grouped by project/folder label. |
| `<timestamp>-timeline-sessions.html` | `temporal-timeline-sessions.html` | Same timeline data grouped by individual session file. |

The HTML page titles include the same timestamp and graph type, e.g. `<timestamp> — Lineage Full`.

## Active-time metrics

`agent-session-store build` derives active-time estimates from timestamp gaps in metadata-only event rows. The metric is an estimate of timestamp-backed activity, not a guarantee of lifetime project effort.

Current safeguards:

- Visit-bounded Pi sessions use reconstructed arrival/departure rows where available.
- Relocated sessions whose visit range starts at row 1 are treated as likely inherited copied history and excluded from project aggregates.
- Overlapping project intervals are collapsed before aggregation to reduce duplicate/copy overcount.
- Project active-time artifacts export `collapsedIntervals`, `rawIntervalCount`, `excludedSessionIds`, and `coverageWarnings`.
- Sessions without usable timestamped event rows contribute coverage warnings instead of pretending the aggregate is complete.

Relevant outputs:

```text
~/.pi/agent/session-store/build-validation.md
~/.pi/agent/session-store/graph-export.json
```

In `graph-export.json`, top-level `activeTimeMetrics` carries project aggregates, while `temporalActivitySpans` carries session/span-level timing fields. Consumers should display coverage/confidence warnings when present.

## Repo identity

Repo/project identity is modeled separately from cwd/path/bucket so renamed, swapped, moved, forked, or archived repos can be interpreted over time.

Curated/observed sidecar. The DB is a projection; identity facts should be recoverable from sidecars/evidence:

```text
~/.pi/agent/session-store/repo-identities.jsonl
```

Supported record kinds:

```jsonl
{"kind":"repo-identity","stableName":"bespoke-thinking-main-site","displayName":"Bespoke Thinking website","confidence":"manual"}
{"kind":"repo-observation","stableName":"bespoke-thinking-main-site","path":"/path/to/bespoke-thinking-website","validFrom":"2026-05-01T00:00:00Z","confidence":"manual"}
{"kind":"repo-event","eventType":"swap","stableName":"bespoke-thinking-main-site","fromPath":"bespoke-thinking-website","toPath":"bespoke-thinking-website-02","confidence":"manual","manualReviewRequired":true}
```

The store imports these into:

- `repo_identities`
- `repo_observations`
- `repo_events`

Events are interpretation/evidence layers; raw sessions and relocation manifests remain unchanged.

Candidate detection and approval workflow:

```bash
astore repo-identity-candidates
astore approve-repo-identity --candidate repo_candidate_3 --yes
astore approve-repo-identity \
  --stable-name example-project \
  --display-name example-project \
  --path /Users/example/git/example-project-v1 \
  --path /Users/example/git/exampleproject \
  --path /Users/example/git/example-project \
  --yes
```

Candidate detection uses metadata-only signals such as same git remote, name/acronym similarity, same parent folder, and temporal continuity. Weak candidates require manual approval. Approved aliases are appended to `repo-identities.jsonl` and projected into SQLite/JSON exports on the next build.

`astore` is the preferred short CLI alias; `agent-session-store` remains the compatibility fallback.

## Pi session suite relationship

- `agent-session-store`: provider-neutral canonical store, imports, reconstruction, repo identity, reports, and graph-ready exports.
- `pi-session-store`: planned Pi-facing wrapper around common store workflows via one namespaced `/session-store ...` command.
- `pi-session-move`: session move/continuation extension.
- `pi-repo-move`: filesystem repo move extension for actual repo moves (`/repo-move <target>`).
- `pi-session-graph`: renderer/viewer over prepared JSON exports; it should not duplicate canonical inference.

Preferred future Pi slash-command namespaces:

```text
/session-store ...
/session-graph ...
/session-relocate ...
/session-repo ...
```

Compatibility aliases should be preserved during migration rather than broken abruptly.

## Development

Use `jj` locally and Git/GitHub for remote interop:

```bash
jj status
jj log
jj git export
git push origin main
```
