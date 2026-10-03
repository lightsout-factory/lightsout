---
summary: "When a folder holds too many files."
checks: deterministic
severity: advisory
options:
  cap: 20
---

## Folder Size

When a folder holds more than 20 files, not counting tests, group related files under a domain folder named for what they share.

A folder a file router owns is exempt: its file count is the number of routes, a fact about the product.

A long flat folder reads like a listing instead of a description of the product.
