---
id: ass-qmb5
status: in_progress
deps: []
links: []
created: 2026-06-02T18:37:35Z
type: task
priority: 1
assignee: ProbabilityEngineer
---
# Publish agent-session-store npm package

First-publish agent-session-store to npm and configure GitHub trusted publishing so pi-session-graph can depend on the npm package.

## Acceptance Criteria

- Add trusted npm publishing workflow if missing.
- Manually publish first package with npm publish --access public --auth-type=web.
- Configure npm trust github agent-session-store --repo ProbabilityEngineer/agent-session-store --file publish.yml --allow-publish --yes.
- Verify npm trust list and npm view agent-session-store version.
- Document any release notes or manual auth blockers.


## Notes

**2026-06-02T18:38:08Z**

Added and pushed trusted publishing workflow in 901ec37. Manual first publish attempted with npm publish --access public --auth-type=web, but npm returned EOTP and requires browser authentication at the provided npm URL before the package can be published and trusted.

**2026-06-02T18:48:25Z**

Confirmed npm view agent-session-store version => 0.1.1 after user completed first publish. Attempted npm trust github agent-session-store --repo ProbabilityEngineer/agent-session-store --file publish.yml --allow-publish --yes, but npm returned EOTP and requires browser auth before trust can be established.
