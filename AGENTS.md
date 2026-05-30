# Agent Instructions

## Project

`agent-session-store` is private/dev tooling for canonical agent session lineage storage, import adapters, reconstruction, evidence curation, and report generation.

## Principles

- Keep raw inputs immutable: do not mutate Pi session JSONLs or `~/.pi/agent/relocations.jsonl`.
- Preserve privacy: default to metadata, hashes, timestamps, event types, line counts, labels, and evidence; do not dump raw transcript content into reports.
- Treat session lineage as a graph/forest with provenance, confidence, and evidence.
- Support multiple providers/import sources: Pi, oh-my-pi, Codex, Claude, OpenCode, Factory, and future agent transcript formats.
- Separate display names, cwd/project labels, curated lineage names, aliases, and source identities.
- Prefer a canonical resilient store with JSON exports over scattered ad hoc sidecars.
