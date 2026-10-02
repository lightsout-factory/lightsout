---
summary: "The same code written out in more than one place."
checked: true
severity: advisory
options:
  minTokens: 50
---

## Duplicate Code Block

When the same code appears in two or more files, such as loading and error handling, validation or a repeated transformation, write it once where `shared-code-placement` says, and import it.

A class that holds a collaborator and passes calls to it through one-line methods repeats that shape in every class holding the same collaborator. That is never duplication, and this rule does not count it.

Copies drift apart, and a fix then reaches only one of them.
