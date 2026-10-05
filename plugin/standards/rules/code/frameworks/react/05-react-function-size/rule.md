---
summary: "How long a function, a hook and a component may grow."
checks: deterministic
severity: advisory
options:
  function: 80
  hook: 160
  component: 200
---

## React Function Size

Split a function longer than 80 lines. A hook, a function whose name starts with `use`, may run to 160 lines, and a component, a capitalised function in a `.tsx` file, may run to 200. Lines run from the signature to the closing brace, and a callback with no name counts toward the function that holds it.

Extract a piece because it deserves a name, not to win back lines.
