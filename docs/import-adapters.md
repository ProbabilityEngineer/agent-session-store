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

Expected to be Pi-like but must remain a distinct provider. The adapter should not assume identical paths or relocation manifest format until sample data is inspected.

### Codex

TBD after sample export/logs. Preserve provider-native conversation/session ids, timestamps, cwd/project metadata if available, message/tool metadata counts, and content hashes.

### Claude

TBD after sample export/logs. Treat project/session naming separately from cwd labels. Do not store transcript text by default.

### OpenCode

TBD after sample export/logs. Preserve provider-native ids and tool metadata where available.

### Factory

TBD after sample export/logs. Preserve provider-native ids, workspace/project labels, and event metadata.

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
