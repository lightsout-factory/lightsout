---
summary: "Exports in different places that share one name."
checks: deterministic
severity: advisory
requires:
  - multi-export
  - filename-mismatch
---

## Duplicate Export Name

Within a package, give every export a name no other export has. Before you add an export, search the package for that name.

- The same thing written twice: keep one, and move it where `shared-code-placement` says.
- Two different things: rename one, so each name says what it is.

Then a search by name finds the one place a concept lives.
