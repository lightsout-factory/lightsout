---
summary: "When a folder holds too many files."
checks: deterministic
severity: advisory
options:
  cap: 20
---

## Folder Size

A folder holds at most 20 files, not counting tests. This is true of every folder: a subject folder, a module folder and a `common/`.

- Over 20: group related files into subject folders named for what they share.
- 20 or fewer: make no subject folder inside a module folder or a `common/`.
- A module folder counts as one file.
- `types/` and `constants/` are exempt: they hold files only.

A long flat folder reads like a listing instead of a description of the product.
