---
id: ass-ivak
status: open
deps: []
links: []
created: 2026-06-03T03:30:19Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [provenance, raw-sources, manifest, privacy]
---
# Create raw source preservation and import-status manifest

Build a privacy-preserving manifest of all raw source files considered for indexing: path, provider, size, mtime/birthtime, sha256, detected type, import status, skip reason, and linked source/session IDs. Use it to detect changed/missing files and to audit what the canonical store did or did not index.

## Acceptance Criteria

Build produces a raw source manifest; manifest records imported, skipped, duplicate, and error states; reruns can detect changed/missing raw files by hash/mtime; no raw transcript content is copied into the manifest.

