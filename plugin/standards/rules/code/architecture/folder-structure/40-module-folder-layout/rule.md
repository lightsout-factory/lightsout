---
summary: "What goes inside a module folder."
checked: false
severity: advisory
example:
  kind: repo
  focus:
    fail: src/listIssues/run.ts
    pass: src/listIssues/listIssues.ts
---

## Module Folder Layout

Every module folder has the same layout:

- Its main file, named after the folder: `listIssues/listIssues.ts`.
- A `common/` folder for the files only this module uses, when it has any.
- Modules inside it, each a file or folder next to the main file.

Nothing else. Outside a module, a folder holds modules, a `common/`, and domain folders that group related modules. Never invent another kind of folder.

Then a reader knows where to look in any module.
