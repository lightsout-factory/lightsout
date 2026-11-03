---
summary: "When a component gets a folder of its own."
checks: deterministic
severity: advisory
requires:
  - feature-folders
example:
  kind: repo
  focus:
    fail: src/features/issues/components/IssueCard/Header/IssueCardHeader.tsx
    pass: src/features/issues/components/IssueCard/IssueCardHeader.tsx
---

## Component Folder

Keep a component in one file until it has parts only it uses: sub-components, a hook, a type. Then give it a folder of its own name inside the `components/` it sat in, with the component as the folder's main file and its parts flat beside it.

- A part that gains a second user moves up to the folder for its kind.
- A part with parts of its own is a component in its own right: it moves up to `components/` and takes a folder there.
- A folder down to its main file turns back into a file.

Then a component's folder reads as the list of its parts, and no path goes deeper than one folder.
