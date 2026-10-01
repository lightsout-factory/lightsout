---
summary: "How a test file names the file it tests."
checked: true
severity: advisory
---

## Test Not Beside Subject

Name a test file after the one source file it tests, in the same folder: the part before the first dot names a real file there. A test file whose subjects span several source files is a split candidate, not a naming exception.

When one subject genuinely needs more than one test file, such as a pipeline with distinct scenarios, add a camelCase scenario to the name: `<File>.<scenario>.unit.test.ts`, such as `runImplementPipeline.monorepo.unit.test.ts`.

Under a package's router folder the framework owns every dot in a file name, so the subject is the whole name before the test suffix: `runs.$runId.unit.test.tsx` tests `runs.$runId`, never `runs`.
