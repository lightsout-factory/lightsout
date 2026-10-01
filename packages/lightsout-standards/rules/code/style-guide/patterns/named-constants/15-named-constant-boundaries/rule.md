---
summary: "Turning outside text into a named value safely."
checked: false
severity: advisory
---

## Named Constant Boundaries

At a boundary, such as a JSON payload, a query parameter or a database value, an incoming string is not yet a member of the union. Convert it with a small validation function, such as `parseAction`, not a cast (`type-assertion`).
