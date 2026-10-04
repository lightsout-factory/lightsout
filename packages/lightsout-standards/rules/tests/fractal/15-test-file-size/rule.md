---
summary: "When a test file is too long."
checks: deterministic
severity: advisory
options:
  testFile: 400
---

## Test File Size

Keep a test file to 400 lines or fewer. Past the cap, split it by named scenario, one concern per file: `runPipeline.supervisor.unit.test.ts`, `runPipeline.advisories.unit.test.ts`.

Never split a test file into unnamed halves, or delete assertions, to get under the cap.
