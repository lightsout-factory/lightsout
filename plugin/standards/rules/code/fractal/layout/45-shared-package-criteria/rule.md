---
summary: "What belongs in the shared package."
checks: agent
severity: advisory
---

## Shared Package Criteria

In a repo with several packages, never copy code from one package into another. Put it in the shared package, but only when two or more packages need it and it is a contract both sides agree on, such as constants, error codes or pure functions.

- One package needs it: put it in that package's `common/`.
- It depends on a library only one package uses: keep the pure part shared, and wrap it in that package.

Copies in each package drift apart, and a fix then reaches only one of them.
