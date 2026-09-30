---
summary: "an export nothing else references"
checked: true
severity: blocking
example:
  kind: repo
  focus:
    fail: src/feature/buildGreeting.ts
    pass: src/index.ts
---

### Unused Code

Delete unused exports, interfaces, types and functions as soon as they become unused. Keeping them "in case" isn't needed: git history still has them. If you're not sure whether something is used, search before deleting.
