---
summary: "When a subject folder has too few files to be a folder."
checked: true
severity: advisory
example:
  kind: repo
  focus:
    fail: src/billing/common/formatting/formatDate.ts
    pass: src/billing/common/utils/formatDate.ts
---

## Single-File Domain Folder

A domain folder in `common/` needs at least two files. When it holds only one, move that file back into `utils/`.

A folder for one file adds a level to search and groups nothing.
