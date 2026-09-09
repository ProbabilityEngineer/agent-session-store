# Agent Instructions

## Project

- `agent-session-store` provides canonical agent-session lineage storage, import adapters, reconstruction, evidence curation, and reports.
- Keep raw Pi session JSONL and `~/.pi/agent/relocations.jsonl` immutable.
- Preserve privacy: default to metadata, hashes, timestamps, event types, line counts, labels, and curated evidence rather than raw transcript content.
- Treat lineage as a graph/forest with provenance and confidence; keep provider/source identities separate from display labels.
- Support multiple providers/import sources without collapsing provider identities.
- Prefer a canonical resilient store with JSON exports over scattered sidecars.

## Validation

- Use the package's focused `npm run` scripts for reconstruction, validation, indexing, graph export, and identity reports.
- Run the relevant TypeScript validation/build command before finishing changes.

## Version control

- Use normal Git workflows. Inspect `git status` and the diff before committing or pushing.

## Safety and provenance

- Preserve unrelated working changes; ask before deleting files or directories.
- Record meaningful repository work with Turnlog; initialize it when missing and keep `.turnlog/` local-only.
- Use clu for current work tracking. Keep legacy ticket files until their migration is verified.
