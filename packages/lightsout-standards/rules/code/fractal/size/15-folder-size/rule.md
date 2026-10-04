---
summary: "When a folder holds too many files."
checks: deterministic
severity: advisory
options:
  cap: 20
---

## Folder Size

When a folder holds more than 20 files, not counting tests, group related files into subject folders named for what they share.

- A module folder counts as one file.
- `types/` and `constants/` are exempt: they hold files only.

A long flat folder reads like a listing instead of a description of the product.
