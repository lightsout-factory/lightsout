---
summary: "How folder names are cased."
checked: true
severity: advisory
requires:
  - case-collision
---

## Folder Casing

Case a folder's name like what it holds:

- A folder that groups things is camelCase: `utils/`, `types/`, `formatting/`, `apiTokens/`.
- A module that became a folder, as `module-file-to-folder` says, takes its item's name and casing, so a class or component folder is PascalCase: `HttpClient/`, `IssuePanel/`.

Decide in this order: the convention the directory already follows, then the rules for the package's framework (NestJS is kebab-case throughout, and URL route segments are kebab-case), then the defaults above.

When a new PascalCase folder would differ only by case from a sibling, such as `Markdown/` beside `markdown.d.ts`, `case-collision` wins. Move or rename the sibling first: it is usually a companion that belongs inside the new folder, or a declaration file to name for what it declares. Never drop the folder to camelCase, which would leave the repo with two casing conventions.

Then a folder's casing tells a reader what kind of thing it holds.
