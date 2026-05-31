---
id: ass-provider-activity-summaries
status: open
deps: []
links: []
created: 2026-05-31T16:00:00Z
type: feature
priority: 2
assignee: ProbabilityEngineer
---
# Extract privacy-preserving provider activity summaries

Extract tool/file activity metadata from Pi and external provider sessions without storing transcript content.

## Acceptance Criteria

- Capture tool names/counts per session where available.
- Capture touched file path summaries as normalized paths and/or hashes, not file contents.
- Store activity in evidence/session metadata or a dedicated table/export shape.
- Works for at least Pi, Codex, oh-my-pi, Claude, OpenCode, and Factory where format supports it.
- No raw transcript/message text is stored by default.
