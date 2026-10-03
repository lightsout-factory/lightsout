---
summary: "When a module should stay one file, and when it should become a folder."
checks: agent
severity: advisory
example:
  kind: repo
  focus:
    fail: src/RateLimiter/RateLimiter.ts
    pass: src/RetryPolicy/RetryPolicy.ts
---

## Module File to Folder

A module is one exported item and the code only it uses.

- Keep a module in one file. TypeScript hides everything a file does not export, so its helpers stay private for free.
- Turn it into a folder only when it needs more files that only it uses, such as its own types, constants or helpers.
- When the folder is down to one file, turn it back into a file.
- This applies at every level, including a module inside another module's folder.
- The type folders in `common/` are not modules, so this rule does not apply to them.
