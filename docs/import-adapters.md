# Import Adapter Architecture

Import adapters convert provider-specific session/transcript data into the canonical store model described in `docs/canonical-store.md`.

## Contract

Each adapter should:

1. register one or more `sources`
2. create an `import_run`
3. emit normalized `sessions` and `session_observations`
4. emit privacy-safe `events` metadata where useful
5. emit `labels` for display names, cwd labels, project labels, lineage labels, and source labels
6. emit `edges`, `classifications`, and `evidence` only when supported by provider data or curated review
7. never mutate raw provider files
8. avoid raw transcript text by default

## Provider notes

### Pi

Inputs:

- `~/.pi/agent/sessions/**`
- `~/.pi/agent/relocations.jsonl`
- `~/.pi/agent/session-graph/lineage-overlays.jsonl`
- curated reconstruction sidecars

Normalized facts:

- session id from filename
- start timestamp from filename
- cwd from session rows
- line/byte counts and content hashes
- relocation edges from manifest
- curated labels/classifications/evidence from overlays
- named startup sessions (`--name` / `-n`) as `display_name` labels when present

### oh-my-pi

Implemented as provider `oh-my-pi`. The adapter scans `omp/agent/sessions/**/*.jsonl`, parses the initial `type=session` row for short provider id, timestamp, cwd, and title, and stores event type counts plus line/byte/hash metadata. Manual HTML/Markdown exports are artifacts, not duplicate sessions.

### Codex

Implemented as provider `codex`. The adapter scans `codex/sessions/**/*.jsonl`, parses `session_meta`, `turn_context`, `event_msg`, and `response_item` rows for provider id, cwd, model/version metadata, timestamps, and event type counts. Transcript text is not stored by default.

### Claude

Implemented as provider `claude`. The adapter scans `claude/transcripts/*.jsonl` and stores metadata-only transcript observations: session id from filename, event/tool counts, timestamps, hashes, and cwd/path evidence when available. Claude project/task/plans/snapshot directories remain artifact/evidence candidates.

### OpenCode

Implemented as provider `opencode`. The adapter scans `opencode-sessions/storage/session/*/*.json`, uses OpenCode session ids, project ids, directory/cwd, title/slug, created/updated times, and counts linked message files. Message/part raw text is not stored by default.

### Factory

Implemented as provider `factory`. The adapter scans `factory/sessions/**/*.jsonl`, parses `session_start`, `message`, and `todo_state` rows, records cwd/title/owner/event counts, and marks one-row `session_start`-only observations as trivial.

### Late

Implemented as provider `late`. The adapter pairs `session-*.json` histories with `session-*.meta.json`, storing id/title/created/updated/message counts, role counts, hashes, and trivial/test flags for small `hi`/help sessions.

### Rovo Dev

Implemented as provider `rovodev`. The adapter scans `rovodev/sessions/*/session_context.json`, extracts session id, workspace path, title, message count, and metadata hashes. `prompt_history` is treated as artifact/evidence, not a session.

### Manual exports

Implemented as artifacts. The adapter scans `codex/manual-markdown-exports`, `omp/manual-markdown-exports`, and `omp/html-session-exports`, extracts embedded provider session ids, and records `manual_session_export` or `manual_session_bundle` artifacts linked by metadata. These are not imported as sessions.

### Git repository evidence

This adapter imports source repository activity windows as evidence, not as session lineage truth.

Useful for abandoned/old extension folders such as:

```text
/Users/sam/git/agents/x-pi-old-extensions
```

Extract:

- repository path/name
- VCS type (`git`, `git+jj`)
- remote URL when present
- first/last commit hashes and timestamps
- first/last commit subjects as evidence summaries

These records can later be cross-linked to session observations by cwd/timestamp overlap.
