---
summary: "What the inside of a common folder looks like."
checks: deterministic
severity: advisory
example:
  kind: repo
  focus:
    fail: src/billing/common/Rate.ts
    pass: src/billing/common/types/Rate.ts
---

## Common Folder Layout

Inside `common/`:

- A function or class sits directly in `common/`.
- A type goes in `common/types/`, a constant in `common/constants/`. A value not written as a function or class is a constant, one built by a call included.

Then where a shared file goes is never a choice, and a reader knows where to look.
