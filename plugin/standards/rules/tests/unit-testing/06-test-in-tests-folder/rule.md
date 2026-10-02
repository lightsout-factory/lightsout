---
summary: "Where a unit test file sits."
checked: true
severity: advisory
---

## Test in Tests Folder

Put a unit test beside the file it tests: `src/auth/AuthService.ts` is tested by `src/auth/AuthService.unit.test.ts`. Never put one in a `__tests__/`, `tests/` or `test/` folder under `src/`.
