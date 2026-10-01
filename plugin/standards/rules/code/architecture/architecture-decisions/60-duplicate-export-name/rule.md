---
summary: "Exports in different places that share one name."
checked: true
severity: advisory
---

## Duplicate Export Name

Before you add an export, search the repository for one with the same name. Two exports with one name are usually one thing written twice: keep one, and move it to the `common/` both users share, as `shared-code-placement` says.

Two may share a name only when they are different things, or the same idea built separately for packages that cannot share code.

Then a search by name finds the one place a concept lives.
