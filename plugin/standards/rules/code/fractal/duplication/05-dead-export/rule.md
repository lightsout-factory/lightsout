---
summary: "Code that nothing uses any more."
checked: true
severity: blocking
example:
  kind: repo
  focus:
    fail: src/feature/buildGreeting.ts
    pass: src/index.ts
---

## Dead Export

Delete an export that nothing references, not even a test, as soon as it becomes unused. This covers interfaces, types and functions as well as values.

- Never keep code in case it is needed later: version history still has it.
- When you are not sure whether something is used, search before you delete it.

Unused code still has to be read, and kept compiling, by everyone who passes it.
