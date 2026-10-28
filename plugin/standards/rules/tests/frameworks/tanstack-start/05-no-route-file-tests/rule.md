---
summary: "Whether a route file gets a unit test."
checks: agent
severity: advisory
example:
  kind: repo
  focus:
    fail: src/routes/issues.unit.test.tsx
    pass: src/issues/IssuesScreen/IssuesScreen.unit.test.tsx
---

## No Route File Tests

Never write a unit test for a route file under `routes/`. Test the screen the route renders instead.

A route file is thin wiring: guards, a loader and one screen. The screen's own tests and the end-to-end tests cover it.
