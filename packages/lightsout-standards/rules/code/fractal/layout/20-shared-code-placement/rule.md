---
summary: "Where a file belongs, from who uses it."
checks: both
severity: advisory
example:
  kind: repo
  focus:
    fail: src/billing/common/formatMoney.ts
    pass: src/common/formatMoney.ts
---

## Shared Code Placement

Put a file where its users are.

- Used by one file: beside that file, in its module folder.
- Used by two or more files: in the `common/` of the lowest folder that holds them all.
- Used from outside its subject folder: at the top level of that subject folder.

When a file gains a user, move it, update the imports, and check the move made no circular imports.

Then where a file sits shows who uses it.
