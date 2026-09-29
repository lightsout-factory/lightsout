---
summary: "Files in `common/` go in a folder for their kind of code."
checked: true
severity: advisory
example:
  kind: repo
  focus:
    fail: src/billing/common/formatRate.ts
    pass: src/billing/common/utils/formatRate.ts
---

## File Directly in Common

Never put a file directly in `common/`. Put it in the folder for its kind of code, `utils/`, `types/`, `constants/` or `services/`, or in a domain folder.

- Make that folder with its first file. A type folder with one file is fine.
- Never invent a new type folder.

Then where a file goes is never a choice, and a reader knows where to look.
