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

```bash
agent-session-store build
agent-session-store export-graph
agent-session-store scan-repos
agent-session-store repo-identities
agent-session-store backup-readiness
```

The CLI wraps the existing scripts and keeps canonical data preparation separate from graph rendering.

## Main scripts

```bash
npm run build-store          # build SQLite + JSON exports
npm run export-graph         # graph-ready JSON for pi-session-graph
npm run repo-identities      # markdown report for repo identities/events
npm run scan-repos           # append observed repo identity records to sidecar
npm run enrich-github-repos  # optional GitHub API enrichment when GITHUB_TOKEN/GH_TOKEN is set
npm run backup-readiness     # backup extraction readiness report
npm run inventory-buckets    # session bucket inventory/reconciliation
npm run logical-threads      # logical thread/resume target report
npm run reconstruct          # local history reconstruction
npm run validate-timeline    # timeline validation
npm run index-segments       # metadata-only session segment index
npm run prefix-lineage       # prefix/common-prefix lineage reconstruction
npm run temporal-lineage     # Mermaid lineage/timeline reports: lineage-full, lineage-focused, timeline-projects, timeline-sessions
npm run temporal-lineage-svg # SVG lineage graph, no Mermaid size limit
npm run lint                 # TypeScript check
```

## Generated artifacts

```text
~/.pi/agent/session-store/session-store.sqlite
~/.pi/agent/session-store/session-store.export.json
~/.pi/agent/session-store/graph-export.json
~/.pi/agent/session-store/repo-identities.md
~/.pi/agent/session-store/session-bucket-reconciliation.json
~/.pi/agent/session-store/session-bucket-reconciliation.md
~/.pi/agent/session-store/logical-threads.md
~/.pi/agent/session-graph/curated-store.json
```

SQLite is the canonical local database. JSON exports are portable/reviewable projections for graph viewers and disaster recovery.

`npm run temporal-lineage` writes four named graph reports under `~/.pi/agent/session-graph/`:

| File | Previous name | Meaning |
|---|---|---|
| `lineage-full.html` | `temporal-lineage.html` | Full temporal lineage graph: all visible lineage edges plus connected/significant standalone session starts. |
| `lineage-focused.html` | `temporal-lineage-focused.html` | Focused temporal lineage graph: sessions with one or more visible relocation/move/overlay edges; omits standalone starts. |
| `timeline-projects.html` | `temporal-timeline.html` | Timeline grouped by project/folder label. |
| `timeline-sessions.html` | `temporal-timeline-sessions.html` | Same timeline data grouped by individual session file. |

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
