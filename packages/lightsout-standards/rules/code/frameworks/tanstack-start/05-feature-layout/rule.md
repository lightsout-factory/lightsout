---
summary: "How a feature is laid out, and which folder names the framework adds."
checks: both
severity: advisory
requires:
  - file-placement
  - module-file-to-folder
example:
  kind: repo
  focus:
    fail: src/features/issues/screens/IssuesScreen/components/IssueRow.tsx
    pass: src/issues/IssuesScreen/IssueRow.tsx
---

## Feature Layout

A feature is a subject folder at the top of `src/`, and it grows as every folder does: a module is a file until it needs a folder, a file sits where its users are, and siblings share through `common/`. The framework adds two folder names to the three kinds the layout rules allow, and no others:

- `routes/`, at the top of `src/`, holds the route files the framework owns.
- `server/`, inside a feature, holds its server functions.

What a route or another feature imports sits at the feature's top level: its screens, named with a `Screen` suffix, and its query options factories, named with a `QueryOptions` suffix. A hook's name starts with `use`. Kind lives in the name, so no folder is named for one: no `features/`, `screens/`, `components/`, `hooks/` or `queries/`, at any depth.

A feature imports another feature only from its top level, never from its `common/` or `server/`.

Then one rule places every file at every depth, and a path reads subject, subject, subject rather than kind, kind, kind.
