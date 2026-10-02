---
summary: "Where code that several modules use belongs."
checked: false
severity: advisory
example:
  kind: repo
  focus:
    fail: src/billing/common/utils/formatMoney.ts
    pass: src/common/utils/formatMoney.ts
---

## Shared Code Placement

Put shared code in the `common/` of the lowest folder that holds every file using it.

- Code that only one module uses stays in that module.
- When a second module needs it, move it up to the `common/` of the lowest folder that holds both, update the imports, and check that the move made no circular imports.
- A type or function that is part of a module's own API, such as the options its function takes, stays in that module. Other modules import it from there.

Then where a file sits shows who uses it.
