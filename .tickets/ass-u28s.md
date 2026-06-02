---
id: ass-u28s
status: open
deps: []
links: []
created: 2026-06-02T18:29:42Z
type: task
priority: 1
assignee: ProbabilityEngineer
---
# Build JS dist for agent-session-store CLI

Package agent-session-store as built JavaScript so it can be used reliably as a dependency/CLI from pi-session-graph and npm/git installs.

## Acceptance Criteria

- TypeScript build emits dist JS and declarations.
- package.json bin points to built dist CLI JS, not bin/*.ts.
- Commit dist if needed for Pi git install reliability.
- agent-session-store CLI smoke test passes from built JS.
- npm run build/lint passes.
- README documents npm/global bin path and intended use as pi-session-graph backend.

