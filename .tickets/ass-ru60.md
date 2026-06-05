---
id: ass-ru60
status: closed
deps: []
links: []
created: 2026-06-05T01:15:10Z
type: bug
priority: 1
assignee: ProbabilityEngineer
tags: [active-hours, metrics, overcount, visit-rows]
---
# Audit active-time metric overcount from copied session history

Investigate and fix inflated active-time totals caused by copied/relocated Pi session history being counted as work for later projects. Known suspicious examples: pi-move shows ~65h from two long spans; pi-diet-ledger shows very large totals from sessions whose row ranges start at row 1 and span copied history. The metric must distinguish actual project visit work from inherited transcript history.

## Acceptance Criteria

Build validation report flags suspicious active-time spans where arrivalRow=1 plus long copied-history duration or overlapping duplicate sessions inflate project totals; activeTime derivation excludes or downweights inherited copied history; pi-move/pi-diet-ledger no longer dominate charts unless supported by visit-bounded evidence; tests or fixture checks cover copied/relocated history overcount.

