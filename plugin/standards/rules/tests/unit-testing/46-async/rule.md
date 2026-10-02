---
summary: "Testing asynchronous code."
checked: false
severity: advisory
---

## Async

Give an async mock its result with `mockResolvedValue` or `mockRejectedValue` in the setup factory (`test-mock-return-in-hook`), `await` the act in the test, and assert a rejection with `await expect(act).rejects.toThrow(...)`.
