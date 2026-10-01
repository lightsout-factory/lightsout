---
summary: "How server functions and their files are named."
checked: false
severity: advisory
requires:
  - filename-mismatch
---

## File Naming for Server Functions

End a server function's name with `ServerFn`, such as `countIssuesServerFn`, in a file of the same name. A server function's folder takes its name without the suffix: `findIssues/`. A GraphQL document constant is PascalCase, in a file of its name: `FindIssuesDocument.ts`.

The suffix makes a call to the server recognisable where it is imported.
