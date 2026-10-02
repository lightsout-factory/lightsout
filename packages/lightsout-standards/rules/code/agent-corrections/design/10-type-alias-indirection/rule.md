---
summary: "Files that only give another type a new name."
checked: true
severity: advisory
---

## Type Alias Indirection

Never create a file only to give another type a new name, such as `export type FilterOptions = TableFilterState`. Use the original type directly. When the difference in meaning matters, say so in a comment where the type is used.

A comment states the difference without sending every reader through one more file.
