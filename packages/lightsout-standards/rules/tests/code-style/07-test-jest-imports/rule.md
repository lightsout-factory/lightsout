---
summary: "What a test file imports from Jest."
checks: agent
severity: advisory
---

## Test Jest Imports

Import the test functions first: `import { expect, describe, test, jest } from '@jest/globals';`. Import `jest` only when the file uses `jest.fn`, `jest.mock` or `jest.spyOn`, and `beforeEach`, `afterEach` or `afterAll` only when you need one; with setup factories and config-level mock cleanup, most files need none.
