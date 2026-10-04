---
summary: "Names that differ only in upper and lower case."
checks: deterministic
severity: blocking
---

## Case Collision

Never put two siblings in a folder whose names differ only by case, including a file beside a folder: `readme.md` beside `README.md`, or `Gates.ts` beside `gates/`. Rename one of them.

A case-insensitive filesystem such as macOS or Windows sees one entry where Linux CI sees two, so an import can reach a different file on the machine that checks it, and a type checker objects late or, in plain JavaScript, never.
