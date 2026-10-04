---
summary: "What the inside of a common folder looks like."
checks: deterministic
severity: advisory
options:
  cap: 20
example:
  kind: repo
  focus:
    fail: src/billing/common/formatting/formatRate.ts
    pass: src/billing/common/formatRate.ts
---

## File Directly in Common

Inside `common/`:

- A function or class sits directly in `common/`.
- A type goes in `common/types/`, a constant in `common/constants/`. A value not written as a function or class is a constant, one built by a call included.
- Make no other folder until `common/` holds more than 20 files. Then group its functions into subject folders, such as `formatting/`.

Then where a shared file goes is never a choice, and a reader knows where to look.
