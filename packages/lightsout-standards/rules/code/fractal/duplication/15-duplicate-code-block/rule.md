---
summary: "The same code written out in more than one place."
checks: deterministic
severity: advisory
options:
  minTokens: 50
---

## Duplicate Code Block

When the same code appears in two or more files, such as loading and error handling, validation or a repeated transformation, write it once where `file-placement` says, and import it.

Copies drift apart, and a fix then reaches only one of them.
