---
summary: "Where a test's state is built."
checks: deterministic
severity: blocking
---

## No Test State in Hooks

Never build a test's state in a `beforeEach`. Build it in the setup factory, which each test calls:

- Never keep test state, the subject under test included, in a `let` that a `beforeEach` reassigns. Return it from the setup factory as a `const`.
- Set a mock's return value or implementation (`mockReturnValue`, `mockResolvedValue`, `mockRejectedValue`, `mockImplementation`) in the setup factory, never in a `beforeEach`.
- Act and assert in the `test`, never in a `beforeEach`.

Then each test states its own arrangement, and none depends on what another left behind.
