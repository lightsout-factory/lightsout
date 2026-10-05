---
summary: "How long a function may grow."
checks: deterministic
severity: advisory
options:
  function: 80
---

## Function Size

Split a function longer than 80 lines. Lines run from the signature to the closing brace, and a callback with no name counts toward the function that holds it.

Extract a piece because it deserves a name, not to win back lines.
