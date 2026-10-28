---
summary: "Where a server function lives, and what one file of it holds."
checks: both
severity: advisory
requires:
  - feature-layout
  - module-file-to-folder
example:
  kind: repo
  focus:
    fail: src/issues/IssuesScreen/findIssues.ts
    pass: src/issues/server/findIssues.ts
---

## Server Function Boundary

Put every `createServerFn` in a feature's `server/` folder, one per file, named for what it does. A server function that takes input declares its validator. A document or helper only that function uses sits beside it, as `module-file-to-folder` says, and nothing outside `server/` imports a server-only dependency.

`server/` is the one place a feature's code runs on the server, so the client/server line is read from the tree, and a server dependency reaching the client shows as a wrong import path.
