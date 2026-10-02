---
summary: "Where a unit test file sits, and what it is named."
checked: true
severity: advisory
example:
  kind: repo
  focus:
    fail: src/feature/tests/getLabel.unit.test.ts
    pass: src/feature/getLabel.unit.test.ts
---

## Test Beside Subject

Put a unit test beside the one source file it tests, and name it after that file: `src/auth/AuthService.ts` is tested by `src/auth/AuthService.unit.test.ts`. The part of the test's name before the first dot names a real file in the same folder.

- Never put a unit test in a `__tests__/`, `tests/` or `test/` folder under `src/`.
- A test file whose subjects span several source files is a split candidate, not a naming exception.
- When one subject genuinely needs more than one test file, such as a pipeline with distinct scenarios, add a camelCase scenario to the name: `<File>.<scenario>.unit.test.ts`, such as `runImplementPipeline.monorepo.unit.test.ts`.
- Under a package's router folder the framework owns every dot in a file name, so the subject is the whole name before the test suffix: `runs.$runId.unit.test.tsx` tests `runs.$runId`, never `runs`.

Then a file's test is found beside it, under its name.
