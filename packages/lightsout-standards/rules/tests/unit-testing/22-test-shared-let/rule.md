---
summary: "Test state shared through variables."
checked: true
severity: blocking
---

## Test Shared Let

Never keep test state, the subject under test included, in a `let` that a `beforeEach` reassigns. Build it in the setup factory and return it as a `const`, so no test depends on what another left behind.
