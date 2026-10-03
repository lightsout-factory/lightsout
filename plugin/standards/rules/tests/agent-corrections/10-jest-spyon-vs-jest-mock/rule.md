---
summary: "What to mock, and with which tool."
checks: agent
severity: advisory
---

## `jest.spyOn` vs `jest.mock`

Construct the subject under test directly, and stub only the boundaries you do not own: the network, the filesystem, other modules' services. Never mock what you own and could simply build.

- Use `jest.spyOn` for one method on an object you already hold, such as an injected service or repository; the rest stays real.
- Use `jest.mock` for a standalone function exported from another module.
- Never mock a module that only exports plain constants; import the real one, since mocking it blocks coverage and adds no isolation. Mock one only when it has import-time side effects, or when the test needs a different value, and then prefer `jest.replaceProperty` or injection.
