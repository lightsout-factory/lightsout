---
summary: "Where shared test helpers, mocks and fixtures live."
checks: deterministic
severity: advisory
---

## Test Support in Src

Keep shared test helpers, mocks and fixtures out of `src/`, in the package's test-support folders, such as `tests/helpers/`, `test/mocks/` and `test/fixtures/`. Only test files sit beside their source.

- A mock one test file uses stays in that file.
- A mock several tests in one area share goes in a `__mocks__/` folder beside the module it doubles, the one test-support folder allowed under `src/`.
- A mock, fixture or utility the whole codebase uses goes in `test/mocks/`, `test/fixtures/` or `test/utils/`.

Under `src/`, test-support code reads as production source, to scanners and people alike.
