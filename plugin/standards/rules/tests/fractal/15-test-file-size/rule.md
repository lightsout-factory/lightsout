---
summary: "When a test file is too long."
checks: deterministic
severity: advisory
options:
  testFile: 400
requires:
  - module-boundary-testing
---

## Test File Size

Keep a test file to 400 lines or fewer. Arrangement earns tests more room than source, but a test file past the cap is almost never thorough: it is the boundary test of a module whose internal units have no tests of their own, absorbing all their contracts through its one public file.

Fix the module, not the test file:

1. Give each internal unit the file is really testing a direct test beside it, asserting on the unit itself. The unit may not be a file yet: a long schema or config object tested block by block is several contracts in one file, so split the source into its blocks first, then test each, as `module-boundary-testing` allows.
2. Leave the boundary test only what the boundary owns: the sequence, the short-circuits, which units run at all, and the order of the result.
3. Then delete the boundary tests the move made redundant. One whose every claim a unit's direct test now pins, or another module's own test of the same renderer or parser, is duplicate coverage, and deleting it is consolidation. Never delete a claim that afterwards lives nowhere.

One shape is different: a pipeline whose units already have their own direct tests, and whose long test file is end-to-end scenarios of the pipeline's own outcomes. There is no unit left to test apart, so there, and only there, split the scenarios by named concern, such as `runPipeline.supervisor.unit.test.ts` and `runPipeline.advisories.unit.test.ts`, each with one concern and its own fixtures.

Splitting a test file into unnamed halves, or deleting assertions to get under the cap, clears the finding and keeps the problem.
