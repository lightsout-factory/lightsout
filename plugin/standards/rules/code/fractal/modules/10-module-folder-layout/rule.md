---
summary: "What goes inside a module folder."
checks: agent
severity: advisory
example:
  kind: repo
  focus:
    fail: src/listIssues/run.ts
    pass: src/listIssues/listIssues.ts
---

## Module Folder Layout

Every module folder has the same layout:

- Its main file, named after the folder: `listIssues/listIssues.ts`. The folder takes its item's name and casing, so a class or component folder is PascalCase: `HttpClient/`, `IssuePanel/`.
- A `common/` folder for the files only this module uses, when it has any.
- Modules inside it, each a file or folder next to the main file.

Nothing else. Outside a module, a folder holds modules, a `common/`, and domain folders that group related modules. Never invent another kind of folder.

`common/` holds only files that other code imports directly, never a module with files of its own:

- When shared code needs a file that only it uses, move it out of `common/` into its own module folder, next to the `common/` it left, and move that file into the module's own `common/`.
- This includes a domain folder: once one of its files exists only to serve the others, it is a module and moves out.

Then a reader knows where to look in any module, and `common/` stays a list of things to import.
