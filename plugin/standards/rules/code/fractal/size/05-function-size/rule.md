---
summary: "How long a function may grow."
checks: deterministic
severity: advisory
options:
  function: 80
---

## Function Size

Split a function longer than 80 lines. Lines run from the signature to the closing brace, and a callback with no name counts toward the function that holds it.

A function is exempt when every statement calls a named step, or assigns that call's result, and the flow is linear. One inline loop, branch or transformation ends the exemption: a 150-line `start()` that calls eight steps is fine, but one with an inline loop is not. It has nothing to extract, and splitting it would scatter the sequence.

Reach for the exemption last. Extract the work into named pieces first, then look again: what remains is short, or plainly a sequence.

Each piece you extract is a new name to read, and perhaps a new file. Extract a piece because it deserves a name, not to win back lines.
