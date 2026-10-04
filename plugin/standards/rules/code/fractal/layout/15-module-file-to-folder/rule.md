---
summary: "When a module should stay one file, and when it should become a folder."
checks: deterministic
severity: advisory
example:
  kind: repo
  focus:
    fail: src/billing/RateLimiter/RateLimiter.ts
    pass: src/billing/RateLimiter.ts
---

## Module File to Folder

Keep a module in one file until it needs files of its own. When a module folder holds only its main file, turn it back into a file.
