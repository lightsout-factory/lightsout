---
summary: "Where a server function lives, and what one file of it holds."
checks: both
severity: advisory
requires:
  - feature-layout
example:
  kind: repo
  focus:
    fail: src/features/issues/utils/findIssues.ts
    pass: src/features/issues/server/findIssues.ts
---

## Server Function Boundary

Put every `createServerFn` in a `server/` folder, one per file, named for what it does. A server function that takes input declares its validator. Server-only code only that function uses sits beside it in `server/`, and nothing outside `server/` imports a server-only dependency.

`server/` is the one place code runs on the server, so the client/server line is read from the tree, and a server dependency reaching the client shows as a wrong import path.
