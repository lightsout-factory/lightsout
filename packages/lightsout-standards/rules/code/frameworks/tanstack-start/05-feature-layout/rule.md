---
summary: "Which folders the framework adds to a feature, and what a route reaches into."
checks: deterministic
severity: advisory
requires:
  - feature-folders
example:
  kind: repo
  focus:
    fail: src/routes/issues.tsx
    pass: src/routes/issues.tsx
---

## Feature Layout

Lay a feature out as the React layout rules say, with two folders the framework adds: `queries/` for its query options factories and `server/` for its server functions. Server-only code several features share sits in `server/` at the top of `src/`.

A route reaches a feature through `screens/`, `queries/`, `utils/` and `server/`, and nothing else in it.

Then what a route may touch, and where the server begins, are both read from the tree.
