---
id: ass-manual-export-artifacts
status: open
deps: [ass-codex-adapter, ass-oh-my-pi-adapter]
links: []
created: 2026-05-31T07:05:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Import manual Markdown/HTML exports as artifacts, not sessions

Import manual exports such as Codex/OMP terminal markdown saves and OMP HTML exports as artifacts/evidence linked to provider-native sessions, avoiding duplicate session records.

## Acceptance Criteria

- Read organized manual exports from `codex/manual-markdown-exports`, `omp/manual-markdown-exports`, and `omp/html-session-exports`.
- Match exports to provider session ids found in filenames or embedded text.
- Link artifacts to one or more session ids/observations when matches exist.
- For multi-session markdown bundles, classify as `manual_session_bundle`.
- For unmatched exports, classify as `manual_export_unmatched` for review.
- Do not store raw export content by default; store path, hash, size, matched ids, and evidence summary.
- Update docs/import-adapters.md.
- TypeScript check passes.
