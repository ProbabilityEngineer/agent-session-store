# Canonical Agent Session Store Design

## Status

Draft for `psg-eh6b`.

## Goal

Create a resilient canonical store for agent session lineage, import metadata, reconstruction evidence, curated labels, and generated report inputs.

The store lets us delete or archive bulky local backup session folders after extracting the durable facts needed for lineage reconstruction and reporting.

## Non-goals

- Do not replace raw provider logs as evidence.
- Do not mutate Pi session JSONLs or `~/.pi/agent/relocations.jsonl`.
- Do not store raw transcript content by default.
- Do not force every provider into a Pi-specific schema.
- Do not make `pi-session-graph` responsible for heavy import/reconstruction work.

## Architecture

Use a canonical SQLite database as the primary local store, plus deterministic JSON exports for portability, review, and disaster recovery.

Default paths:

```text
~/.pi/agent/session-store/session-store.sqlite
~/.pi/agent/session-store/session-store.export.json
```

Compatibility/read aliases may also be written under:

```text
~/.pi/agent/session-graph/
```

until `pi-session-graph` reads the store directly.

## Raw inputs remain immutable

Raw inputs are never rewritten:

- Pi session JSONLs under `~/.pi/agent/sessions/**`
- Pi relocation manifest `~/.pi/agent/relocations.jsonl`
- backup-extracted session files
- imported provider transcripts/logs
- source repository git/jj history

The store records normalized facts, hashes, observations, and evidence pointers with provenance.

## Provider and source model

A provider is the originating agent/runtime format. A source is a concrete input location or import target.

Initial providers:

- `pi`
- `oh-my-pi`
- `codex`
- `claude`
- `opencode`
- `factory`
- `git-repository`
- `manual-curation`
- `backup-snapshot`

Provider-specific details go into JSON metadata columns, but common identity/timestamp/label fields are normalized.

## Identity principles

Do not use cwd/repo names as durable identity.

Prefer, in order:

1. provider-native session id, if stable
2. source path + content hash
3. filename timestamp/id conventions
4. first-event hash / prefix hash
5. observed timestamps and line counts as supporting evidence

Keep display names, cwd labels, curated lineage names, aliases, and provider identities separate.

## Label types

Labels have type and provenance:

- `display_name`: provider/user session display name, e.g. Pi `--name` / `-n`
- `cwd`: working-directory-derived label
- `project`: project/repo label
- `lineage`: curated human lineage name
- `alias`: historical rename or path alias
- `source`: imported source/archive label

A graph view can choose label priority without collapsing these concepts.

## Trust and confidence

Every non-raw fact should have provenance and confidence.

Suggested confidence values:

- `authoritative`: direct provider manifest/runtime event, e.g. post-manifest `pi-relocate`
- `high`: backup/session/filesystem evidence corroborates the fact
- `medium`: inferred from filename chains or content prefix evidence
- `low`: forensic or ambiguous signal
- `manual`: human-curated assertion; should link to evidence

## Core tables

### `sources`

Concrete origins of imported data.

Columns:

- `id` TEXT PRIMARY KEY
- `provider` TEXT NOT NULL
- `kind` TEXT NOT NULL — `live_sessions`, `relocation_manifest`, `backup_snapshot`, `git_repository`, `provider_export`, `manual_overlay`
- `uri` TEXT NOT NULL
- `label` TEXT
- `first_observed_at` TEXT
- `last_observed_at` TEXT
- `metadata_json` TEXT NOT NULL DEFAULT '{}'

Examples:

- Pi live sessions directory
- `~/.pi/agent/relocations.jsonl`
- Backblaze extracted snapshot folder
- old extension repo under `x-pi-old-extensions/pi-lens`

### `import_runs`

Each scan/import operation.

Columns:

- `id` TEXT PRIMARY KEY
- `source_id` TEXT NOT NULL REFERENCES `sources(id)`
- `started_at` TEXT NOT NULL
- `finished_at` TEXT
- `tool` TEXT NOT NULL
- `status` TEXT NOT NULL
- `stats_json` TEXT NOT NULL DEFAULT '{}'
- `notes` TEXT

### `sessions`

Canonical session-like entities.

Columns:

- `id` TEXT PRIMARY KEY
- `provider` TEXT NOT NULL
- `provider_session_id` TEXT
- `canonical_key` TEXT NOT NULL UNIQUE
- `first_seen_at` TEXT
- `last_seen_at` TEXT
- `start_timestamp` TEXT
- `end_timestamp` TEXT
- `event_count` INTEGER
- `line_count` INTEGER
- `byte_count` INTEGER
- `content_sha256` TEXT
- `prefix_sha256` TEXT
- `metadata_json` TEXT NOT NULL DEFAULT '{}'

For Pi relocated copies, the same provider session id may appear in multiple files/contexts. Those are separate observations, and may or may not collapse to one canonical session depending on future policy.

### `session_observations`

Concrete files/exports/backups where a session was observed.

Columns:

- `id` TEXT PRIMARY KEY
- `session_id` TEXT REFERENCES `sessions(id)`
- `source_id` TEXT REFERENCES `sources(id)`
- `path` TEXT
- `provider_session_id` TEXT
- `observed_at` TEXT
- `snapshot_label` TEXT
- `file_birthtime` TEXT
- `file_mtime` TEXT
- `file_size` INTEGER
- `line_count` INTEGER
- `first_event_at` TEXT
- `last_event_at` TEXT
- `content_sha256` TEXT
- `prefix_sha256` TEXT
- `metadata_json` TEXT NOT NULL DEFAULT '{}'

This table is where backup-only session files become durable facts before deleting local backup folders.

### `events`

Normalized provider/runtime/session events.

Columns:

- `id` TEXT PRIMARY KEY
- `session_id` TEXT REFERENCES `sessions(id)`
- `source_id` TEXT REFERENCES `sources(id)`
- `provider` TEXT NOT NULL
- `provider_event_id` TEXT
- `event_type` TEXT NOT NULL
- `timestamp` TEXT
- `ordinal` INTEGER
- `role` TEXT
- `tool_name` TEXT
- `summary` TEXT
- `content_sha256` TEXT
- `metadata_json` TEXT NOT NULL DEFAULT '{}'

Raw message text is not stored by default. `summary` must be privacy-safe and curated/importer-derived.

### `edges`

Lineage, relocation, continuation, fork, import, and context-jump relations.

Columns:

- `id` TEXT PRIMARY KEY
- `source_session_id` TEXT REFERENCES `sessions(id)`
- `target_session_id` TEXT REFERENCES `sessions(id)`
- `edge_type` TEXT NOT NULL — `relocation`, `continuation`, `fork`, `context_jump`, `manual_copy`, `same_session_id`, `derived_from`
- `timestamp` TEXT
- `source_observation_id` TEXT REFERENCES `session_observations(id)`
- `target_observation_id` TEXT REFERENCES `session_observations(id)`
- `confidence` TEXT NOT NULL
- `provenance` TEXT NOT NULL
- `metadata_json` TEXT NOT NULL DEFAULT '{}'

Manifest #26 should become an `edge_type = context_jump` or an edge with classification `context-jump-new-lineage`, preserving that it is a real relocation event but not a normal project continuation.

### `labels`

Names/labels attached to sessions, observations, edges, sources, or projects.

Columns:

- `id` TEXT PRIMARY KEY
- `target_type` TEXT NOT NULL — `session`, `observation`, `edge`, `source`, `project`
- `target_id` TEXT NOT NULL
- `label_type` TEXT NOT NULL — `display_name`, `cwd`, `project`, `lineage`, `alias`, `source`
- `value` TEXT NOT NULL
- `valid_from` TEXT
- `valid_to` TEXT
- `confidence` TEXT NOT NULL
- `source_id` TEXT REFERENCES `sources(id)`
- `evidence_id` TEXT
- `metadata_json` TEXT NOT NULL DEFAULT '{}'

Pi named startup sessions (`--name` / `-n`, issue #5153) should be imported as `display_name`, not as cwd/project labels.

### `aliases`

Historical path/project aliases and renames.

Columns:

- `id` TEXT PRIMARY KEY
- `alias_type` TEXT NOT NULL — `path`, `project`, `repo`, `lineage`
- `from_value` TEXT NOT NULL
- `to_value` TEXT NOT NULL
- `valid_from` TEXT
- `valid_to` TEXT
- `confidence` TEXT NOT NULL
- `evidence_id` TEXT
- `notes` TEXT

Example: `pi-jj-vcs` later renamed/continued as `pi-jj-git-align`.

### `classifications`

Curated or inferred classifications for edges, sessions, sources, or observations.

Columns:

- `id` TEXT PRIMARY KEY
- `target_type` TEXT NOT NULL
- `target_id` TEXT NOT NULL
- `classification` TEXT NOT NULL
- `confidence` TEXT NOT NULL
- `source` TEXT NOT NULL
- `evidence_id` TEXT
- `notes` TEXT
- `metadata_json` TEXT NOT NULL DEFAULT '{}'

Examples:

- `explicit-continuation`
- `explicit-new-lineage`
- `context-jump-new-lineage`
- `manual-copy-edit-relocation-experiment`
- `inferred-unresolved`

### `evidence`

Compact support records for claims/classifications/labels/edges.

Columns:

- `id` TEXT PRIMARY KEY
- `kind` TEXT NOT NULL — `manifest_record`, `backup_presence`, `filesystem_stat`, `git_activity`, `prefix_match`, `filename_chain`, `manual_note`, `shell_history`
- `source_id` TEXT REFERENCES `sources(id)`
- `target_type` TEXT
- `target_id` TEXT
- `timestamp` TEXT
- `confidence` TEXT NOT NULL
- `summary` TEXT NOT NULL
- `data_json` TEXT NOT NULL DEFAULT '{}'

Evidence summaries should be metadata-only and privacy-preserving.

### `backup_observations`

Presence/absence windows and snapshot facts from backups.

Columns:

- `id` TEXT PRIMARY KEY
- `source_id` TEXT REFERENCES `sources(id)`
- `session_observation_id` TEXT REFERENCES `session_observations(id)`
- `snapshot_label` TEXT NOT NULL
- `snapshot_timestamp` TEXT
- `path` TEXT NOT NULL
- `presence` TEXT NOT NULL — `present`, `absent`
- `file_mtime` TEXT
- `file_birthtime` TEXT
- `file_size` INTEGER
- `line_count` INTEGER
- `metadata_json` TEXT NOT NULL DEFAULT '{}'

This supports statements like “main root absent at 21:10 BST, present at 21:20 BST” without keeping the full backup tree online.

### `repositories`

Local or remote source repositories that may explain project activity windows.

Columns:

- `id` TEXT PRIMARY KEY
- `source_id` TEXT REFERENCES `sources(id)`
- `path` TEXT NOT NULL
- `name` TEXT
- `remote_url` TEXT
- `vcs` TEXT — `git`, `jj`, `git+jj`, `none`
- `first_commit_at` TEXT
- `last_commit_at` TEXT
- `first_commit` TEXT
- `last_commit` TEXT
- `metadata_json` TEXT NOT NULL DEFAULT '{}'

The abandoned extension folder `/Users/sam/git/agents/x-pi-old-extensions` should be imported here as project activity evidence, not directly as session lineage truth.

### `artifacts`

Generated reports/graphs/exports.

Columns:

- `id` TEXT PRIMARY KEY
- `kind` TEXT NOT NULL — `mermaid`, `html`, `json`, `markdown`, `inventory`, `timeline`
- `path` TEXT NOT NULL
- `generated_at` TEXT NOT NULL
- `generator` TEXT NOT NULL
- `input_hash` TEXT
- `metadata_json` TEXT NOT NULL DEFAULT '{}'

## Import adapters

Each adapter emits normalized source/session/observation/event/label/evidence records.

Initial adapters:

### Pi adapter

Inputs:

- `~/.pi/agent/sessions/**`
- `~/.pi/agent/relocations.jsonl`
- `~/.pi/agent/session-graph/lineage-overlays.jsonl`

Extracts:

- session ids from filenames
- start timestamps from filenames
- cwd rows from session metadata
- line counts, byte counts, first/last timestamps
- relocation edges
- display names when Pi named sessions appear in session metadata

### oh-my-pi adapter

Expected to be Pi-like but should not assume identical file layout. Normalize provider identity separately from Pi.

### Codex / Claude / OpenCode / Factory adapters

TBD after sample data. Each needs:

- provider-native session/conversation id
- timestamp extraction
- cwd/project extraction when available
- message/tool metadata counts
- privacy-safe hashes
- optional raw-path pointers, not raw transcript storage

### Git repository evidence adapter

Inputs:

- abandoned extension folders
- current agent repos
- git/jj metadata

Extracts:

- repository names/paths/remotes
- first/last commit times
- notable commit messages as evidence summaries when useful
- activity windows for cross-linking against sessions

## Migration from current sidecars

Current sidecars are source inputs, not long-term schema:

- `~/.pi/agent/relocations.jsonl`
- `~/.pi/agent/session-graph/lineage-overlays.jsonl`
- `pre-manifest-lineage.json`
- `prefix-lineage.json`
- `temporal-inventory.json`
- backup extracted folders

Migration should:

1. register each file/folder as a `source`
2. create an `import_run`
3. insert sessions/observations/edges/labels/evidence/classifications
4. export deterministic JSON
5. allow `pi-session-graph` to consume either old sidecars or the new store during transition

## Graph projections

Graph/report generators should query the canonical store and produce views:

- focused lineage graph
- topology/progression graph
- project timeline
- session timeline
- inventory JSON
- evidence reports

A projection can choose label priority, e.g.:

1. curated lineage label
2. display name
3. cwd/project label
4. source label
5. bucket/path fallback

## Privacy policy

Default imports store:

- ids
- paths when local/private acceptable
- timestamps
- event types
- roles/tool names
- counts
- hashes
- curated summaries
- evidence metadata

Default imports do not store:

- raw message text
- tool outputs containing transcript content
- secrets/env values
- full copied transcript snippets

Raw transcript paths may be referenced as source URIs if the files remain local/private.

## Repo/bucket batch relocation

A repository/cwd bucket can contain many sessions. Moving a repo should support a batch relocation operation instead of only relocating the current session.

Design records:

- `batch_operations`: operation id, type `bucket_relocation`, source bucket/path, destination bucket/path, timestamp, source tool, dry-run/apply status, counts, metadata.
- per-session `edges`: one relocation/copy edge for each copied session observation.
- per-observation marks: old observations are marked `superseded` or `deletion_candidate`, never deleted automatically.

Batch relocation must be idempotent. Re-running should detect existing destination observations/edges by source observation, destination path, and operation id.

## Observation marks and retention

Add derived marks for raw session observations:

- `active`
- `superseded`
- `archived`
- `deletion_candidate`

Marks need provenance, timestamp, reason, confidence, replacement observation/session when known, and a manual-review requirement. Tools may report deletion candidates, but must not delete raw sessions by default.

## Deterministic relationship rules

Thread membership and edge relations must be derived from deterministic evidence before any model/semantic suggestion is allowed to affect graph or resume behavior.

Relationship classes:

- `continuation`: explicit relocation/manifest or prefix-backed continuation, move semantics, no curated context-jump classification.
- `fork`: explicit branch/copy relocation, multiple destinations from the same source, or parallel active children from the same source.
- `context_jump`: explicit relocation event but curated/deterministic evidence says the destination is a new task/lineage rather than project continuation.
- `sibling`: sessions share cwd/project/provider id but lack direct prefix/relocation edge.
- `unrelated`: deterministic evidence contradicts shared lineage.
- `unknown`: insufficient deterministic evidence.

Rules in priority order:

1. curated `context-jump` classification wins and prevents merge-as-continuation.
2. explicit branch/copy mode is `fork`.
3. explicit move relocation is `continuation` unless classified otherwise.
4. multiple children from one source are forks/branches at the topology level even when each edge is a valid continuation.
5. prefix/common-prefix evidence can support continuation but transcript text alone is forensic, not authoritative.
6. shared provider session id can group into a logical thread but does not by itself prove chronological continuation.
7. model/Semble suggestions are candidates only and cannot affect thread membership or resume targets without deterministic evidence or human curation.

## Model/Semble merge suggestion boundary

Semantic tools may propose merge/thread candidates, but those records are advisory only.

Suggestion records should include:

- candidate source/target sessions or observations
- proposed relation
- model/tool name and version
- confidence as model confidence, not store truth confidence
- reasons and metadata/hashes used
- timestamp and provenance
- required deterministic evidence or human approval before promotion

No graph, availability, deletion, or resume behavior may depend solely on model suggestions. Promotion paths:

1. deterministic evidence later confirms the suggestion, or
2. a human writes a curated classification/evidence record.

Suggested schema:

```sql
CREATE TABLE merge_suggestions (
  id TEXT PRIMARY KEY,
  source_session_id TEXT,
  target_session_id TEXT,
  proposed_relation TEXT NOT NULL,
  suggester TEXT NOT NULL,
  model_confidence TEXT,
  status TEXT NOT NULL DEFAULT 'candidate',
  created_at TEXT NOT NULL,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
```

## Derived logical threads / merge model

Do not merge raw JSONL sessions. Instead create a derived logical merge layer:

- `logical_threads`: human/provider/algorithmic grouping of related sessions.
- `thread_members`: ordered membership of raw sessions/observations with role (`canonical_path`, `fork`, `continuation`, `context_jump`, `reference`).
- `thread_edges`: derived continuation/fork/context-jump edges for display and reports.

This gives a merged view while keeping raw sessions immutable and preserving forks.

## Derived checkpoints and summaries

Finite context should use derived checkpoint/summary artifacts, not raw transcript concatenation.

Checkpoint artifacts should link to logical threads or session observations and record provenance, input hashes, timestamp, summary kind, privacy status, and curator/importer source. Raw transcript content is not stored by default.

## Open decisions

- SQLite library choice for TypeScript (`node:sqlite` vs dependency) once implementation starts.
- Whether canonical `sessions` should merge relocated Pi copies by provider session id or keep each observed file as separate session nodes with a shared logical-thread id.
- Exact JSON export shape.
- Whether store lives under `~/.pi/agent/session-store` or `~/.agent-session-store` for non-Pi providers.
