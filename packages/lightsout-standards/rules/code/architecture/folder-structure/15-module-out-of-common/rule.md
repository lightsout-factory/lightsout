---
summary: "When shared code has grown into a module of its own."
checked: false
severity: advisory
example:
  kind: repo
  focus:
    fail: src/common/permissions/normalizeRole.ts
    pass: src/hasPermission/hasPermission.ts
---

## Module Out of Common

`common/` holds only files that other code imports directly. It never holds a module with files of its own.

- When shared code needs a file that only it uses, move it out of `common/` into its own module folder, next to the `common/` it left, and move that file into the module's own `common/`.
- This includes a domain folder: once one of its files exists only to serve the others, it is a module and moves out.

Then `common/` stays a list of things to import, and every module has the same shape wherever it sits.
