---
id: ass-ybs1
status: closed
deps: []
links: []
created: 2026-06-03T03:27:00Z
type: feature
priority: 1
assignee: ProbabilityEngineer
tags: [imports, codex, claude, opencode, factory, rovodev, omp]
---
# Import non-Pi sessions from developer archive

Import canonical session records from /Users/sam/Desktop/developer-archive/x-backups-coding-sessions, prioritizing keep-session-data provider folders: claude/transcripts, codex/sessions, omp/agent and html exports, opencode-sessions/storage, rovodev/sessions, late/sessions, factory/sessions. Preserve provider, source path, content hash, timestamps, cwd/project/title/model metadata when available, and avoid raw transcript content in exports by default.

## Acceptance Criteria

agent-session-store build creates session records with providers beyond pi; session-store.export.json and graph-export.json include imported codex/claude/opencode/factory/rovodev/omp/late sessions where parseable; import stats report counts and skipped files with reasons; source paths and hashes are recorded for provenance.

