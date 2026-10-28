---
summary: "Which exports leave their return type to inference."
checks: agent
severity: advisory
requires:
  - explicit-return-type
example:
  kind: snippet
---

## Inferred Return Types

Leave the return type to inference on three kinds of export, the one exception to `explicit-return-type`: a component, a query options factory, and a hook that returns a query. Write it out on every other export, as that rule says.

A component's contract is its props, and the element type adds nothing a reader uses. A `queryOptions()` factory and a query hook return deep generic types that carry the key and the data type; an annotation either flattens them or copies a type nobody reads.
