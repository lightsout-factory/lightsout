---
summary: "What an index file may hold."
checks: deterministic
severity: advisory
example:
  kind: repo
  focus:
    fail: src/index.ts
    pass: src/index.ts
---

## Index File Contents

An index file holds only re-export lines, `export { Foo } from '<path>'` and `export type { Bar } from '<path>'`, and comments.

- Re-export each name explicitly, never with `export *`. List what other packages need, and nothing only the package itself uses.
- Put executable code in an entry file with its own name, conventionally `main.ts`, which imports what it runs from the files that declare it.

A package's entry is the list other packages build against. Code in it makes that list hard to read, and a star publishes whatever its target happens to export, so the contract stops being a decision.
