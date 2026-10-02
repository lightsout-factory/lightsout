---
summary: "When functions about one subject should get their own folder."
checked: true
severity: advisory
example:
  kind: repo
  focus:
    fail: src/billing/common/utils/formatCurrency.ts
    pass: src/billing/common/formatting/formatCurrency.ts
---

## Ungrouped Domain Utils

When two or more functions in a `common/utils/` folder share a subject, move them into a domain folder named for that subject, next to `utils/`: `formatting/`, `parsing/`, `validation/`.

- Name the folder for the subject, never for the kind of function: never `getters/` or `predicates/`. Two `is*` functions stay in `utils/`.
- A single function about a subject stays in `utils/`.
- Classes that hold state stay in `services/`, never in a domain folder.

Then all the code about one subject is in one place.
