---
summary: "Functions that are copies of each other under new names."
checks: deterministic
severity: blocking
options:
  minBodyTokens: 40
---

## Duplicate Function Body

Never write a function whose body is another function's with only the names or the literal values changed. Keep one, and pass the values that differed as arguments.

- This covers every function, method and callback, in the same file or another.
- A function that only calls another function with its own fixed values is not a copy: the shared code is already in one place.

Renaming a copy hides it from a search by name, so the two drift apart unseen.
