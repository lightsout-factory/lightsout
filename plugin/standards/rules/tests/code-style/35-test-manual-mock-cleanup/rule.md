---
summary: "Resetting mocks between tests."
checks: deterministic
severity: advisory
---

## Test Manual Mock Cleanup

Leave mock cleanup to the package's Jest config, `clearMocks: true` and `restoreMocks: true`. Never clean mocks by hand in a `beforeEach`, `beforeAll`, `afterEach` or `afterAll`: no `jest.clearAllMocks()`, `jest.resetAllMocks()`, `jest.restoreAllMocks()`, `mockClear()` or `mockReset()` there.

- `clearMocks` clears each mock's calls, instances, contexts and results before each test, but not its return value or implementation (that is `resetMocks`). Each setup factory sets those afresh, so `clearMocks` is enough. Use `resetMocks` only when a package genuinely needs return values cleared too.
- `restoreMocks` also restores every `jest.spyOn` original before each test. It does not touch a standalone `jest.fn()`'s return value.

When the package's config lacks them, never add them. `clearMocks` changes every existing test in the package, and breaks any that relies on a mock set once at module scope or in `beforeAll`. A repo-wide change is the repo owner's decision, not a test task's side effect. Instead:

- Build fresh `jest.fn()` mocks, and a fresh subject, inside each setup factory call.
- Reset a module-level mock that must persist, such as one a `jest.mock` factory reads, at the top of the setup factory with `.mockReset()`, and wire it again. Or assert on it only with `toHaveBeenCalledWith`, which earlier calls cannot fool, and never with `not.toHaveBeenCalled`.
- Report the missing config, so the repo owner can adopt it on purpose.
