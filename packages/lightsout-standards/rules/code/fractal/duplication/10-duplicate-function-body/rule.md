---
summary: "Functions that are copies of each other under new names."
checked: true
severity: blocking
options:
  minBodyTokens: 40
---

## Duplicate Function Body

Never write a function whose body is another function's with only the names or the literal values changed. Keep one, and pass the values that differed as arguments.

- This covers every function, method and callback, in the same file or another.
- Two functions that call different hooks are different: a hook cannot be passed in.
- A method that only forwards to a collaborator its class holds is not a copy.

Renaming a copy hides it from a search by name, so the two drift apart unseen.
