---
summary: "How these rules apply to a repo's existing tests."
checked: false
severity: advisory
---

## Precedence in Repos with Older Tests

These rules describe the tests you write, not a mandate to rewrite the ones already there. When a repo's tests use an older style, such as `beforeEach` with a shared `let`, or nested `describe` blocks:

- When you extend an existing test file, match its style, and never mix a second style into it. A blocking rule still holds in every test you add or change.
- When you create a test file, follow these rules, even when the test you mirror uses the older style. Mirror its coverage, not its structure.
- Never rewrite passing older tests to these rules during a feature task. That is cleanup with its own review.

Following this order is normal work: record no friction entry for each older file. Record one only when this rule failed you, because the conflict was not about style, or it was unclear which case applied.
