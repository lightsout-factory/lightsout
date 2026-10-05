---
summary: "Where shared test helpers, mocks and fixtures live."
checks: deterministic
severity: advisory
---

## Test Support in Src

Keep shared test helpers, mocks and fixtures out of `src/`, in the package's `tests/` folder: `tests/helpers/`, `tests/mocks/`, `tests/fixtures/`. Only test files sit beside their source.

- A mock or helper one test file uses stays in that file.
- One that several test files share goes in `tests/`.

Under `src/`, test-support code reads as production source, to scanners and people alike.
