---
summary: "What an index file may contain."
checked: true
severity: advisory
---

## Code in Index File

An index file holds only re-export lines, `export { Foo } from '<path>'` and `export type { Bar } from '<path>'`, and comments. Put executable code in an entry file with its own name, conventionally `main.ts`, which imports what it runs from the files that declare it.

A package's entry is the list other packages build against, and code in it makes that list hard to read.
