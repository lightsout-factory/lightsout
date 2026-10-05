---
summary: "How mocks are named."
checks: deterministic
severity: blocking
---

## Test Mock Prefix

Start the name of every mock declared at module scope with `mock`, such as `mockGetProfile`. Jest hoists `jest.mock()` calls to the top of the file, and only `mock`-prefixed variables are reachable inside the factory.
