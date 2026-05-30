# agent-session-store

Canonical store and import/reconstruction tooling for agent session lineage.

Repository shorthand:

```text
git:github.com/ProbabilityEngineer/agent-session-store
```

This repo uses colocated `jj` + Git for version control.

This repo is split out from `pi-session-graph` so the graph extension can stay lightweight. It owns heavier private/dev work:

- canonical lineage store design and migration
- backup/session metadata extraction
- reconstruction and validation scripts
- import adapters for Pi, oh-my-pi, Codex, Claude, OpenCode, Factory, and other agent session formats
- curated evidence, classifications, aliases, and labels
- privacy-preserving JSON/HTML reports

## Raw inputs stay immutable

Do not mutate raw session JSONLs or `~/.pi/agent/relocations.jsonl`. The store is a normalized projection with provenance and can be rebuilt from raw inputs and curated sidecars.

## Current scripts

```bash
npm run build-store
npm run reconstruct
npm run validate-timeline
npm run index-segments
npm run prefix-lineage
npm run temporal-lineage
```

These scripts currently read Pi data under `~/.pi/agent/` and write reports under `~/.pi/agent/session-graph/`.

`npm run build-store` writes the current canonical JSON export to:

```text
~/.pi/agent/session-store/session-store.export.json
~/.pi/agent/session-graph/curated-store.json
```

## Relationship to other repos

- `pi-session-graph`: lightweight Pi extension/viewer over prepared graph/store data.
- `pi-relocate`: relocation producer; keeps raw manifest and may later append normalized store events.
- `agent-session-store`: canonical store, imports, reconstruction, and curation.

## Development

Use `jj` locally and Git/GitHub for remote interop:

```bash
jj status
jj log
jj git export
git push origin main
```
