---
summary: "What a test file imports from Jest."
checks: agent
severity: advisory
---

## Test Jest Imports

Import the test functions by name from `@jest/globals`, as the file's first import: `import { describe, expect, test } from '@jest/globals';`. Add `jest` only when the file uses `jest.fn`, `jest.mock` or `jest.spyOn`, and `beforeEach`, `afterEach` or `afterAll` only when the file needs one.
