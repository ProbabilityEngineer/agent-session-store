---
id: ass-i7a0
status: closed
deps: []
links: []
created: 2026-06-02T17:31:19Z
type: task
priority: 2
assignee: ProbabilityEngineer
---
# Build JS dist for agent-session-store CLI

Replace the package bin pointing at a TypeScript file with a standard TypeScript build that emits runnable JS. The CLI should run from built dist without relying on direct .ts execution, for npm and git install reliability.

## Acceptance Criteria

- Add/update build config to emit dist JS and declarations.
- package.json bin points to built dist CLI JS, not bin/*.ts.
- Decide whether to commit dist for git install reliability and document the choice.
- agent-session-store CLI smoke test passes from built JS.
- npm run build/lint passes.

