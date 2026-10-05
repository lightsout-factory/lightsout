---
summary: "Resetting mocks between tests."
checks: deterministic
severity: advisory
---

## Test Manual Mock Cleanup

Leave mock cleanup to the package's Jest config, `clearMocks: true` and `restoreMocks: true`. Never clean mocks by hand in a `beforeEach`, `beforeAll`, `afterEach` or `afterAll`: no `jest.clearAllMocks()`, `jest.resetAllMocks()`, `jest.restoreAllMocks()`, `mockClear()` or `mockReset()` there.

When the package's config lacks them, never add them. That changes every existing test in the package, so it is the repo owner's decision, not a test task's side effect. Instead:

- Build fresh `jest.fn()` mocks, and a fresh subject, inside each setup factory call.
- Reset a module-level mock that must persist, such as one a `jest.mock` factory reads, at the top of the setup factory with `.mockReset()`, and wire it again. Or assert on it only with `toHaveBeenCalledWith`, which earlier calls cannot fool, and never with `not.toHaveBeenCalled`.
- Report the missing config.
