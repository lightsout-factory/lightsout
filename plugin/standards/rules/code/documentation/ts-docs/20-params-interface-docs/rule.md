---
summary: "Doc comments on a function's argument interface."
checked: true
severity: advisory
---

## Params Interface Docs

Never put a doc comment on a function's `Params` interface: the function's `@param` tags already say what each argument is for. A comment on one of its properties is a property comment, which `doc-elements` allows when the name and type don't say enough.
