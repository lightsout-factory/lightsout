---
summary: "How React files are named, and which extension they take."
checked: false
severity: advisory
requires:
  - filename-mismatch
  - folder-casing
---

## File Naming Conventions

Name a React file as `filename-mismatch` says, and its folder as `folder-casing` says.

Give a file the `.tsx` extension only when it contains JSX. A hook or utility with no JSX is `.ts`, such as `useIssues.ts`.

TypeScript parses JSX only in a `.tsx` file, so a `.ts` extension tells the reader the file renders nothing.
