---
summary: "What a feature is, and which folders it holds."
checks: deterministic
severity: advisory
example:
  kind: repo
  focus:
    fail: src/features/issues/ui/IssueRow.tsx
    pass: src/features/issues/components/IssueRow.tsx
---

## Feature Folders

Put every piece of the product in a feature, `src/features/<name>/`, named for what the user does there: `issues/`, `billing/`. A feature holds only these folders, each present only while it has files:

- `screens/` — the components its routes render, one file each. A not-found or error screen for those routes sits here too.
- `components/` — the components its screens compose.
- `hooks/` — its hooks.
- `utils/` — its plain functions.
- `types/` — its types. `constants/` — its constants, a value built by a call included.
- The folders the framework's rules add.

Nothing sits directly under a feature's root, no feature holds another, and every folder in a feature is flat, apart from the component folders `component-folder` allows.

Then everything about one area of the product is in one folder, and inside it a reader looks by kind.
