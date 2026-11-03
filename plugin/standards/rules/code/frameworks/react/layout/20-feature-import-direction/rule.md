---
summary: "Which way imports flow between features and the shared layer."
checks: deterministic
severity: advisory
requires:
  - shared-layer
example:
  kind: repo
  focus:
    fail: src/features/billing/components/InvoiceRow.tsx
    pass: src/features/billing/components/InvoiceRow.tsx
---

## Feature Import Direction

Imports flow one way: the shared layer imports nothing from a feature, a feature imports from the shared layer and from itself, and the app above the features, its routes and entry files, imports from any feature.

When two features need the same code, move it to the shared layer, as `shared-layer` says, and import it from there.

A feature that reaches into no sibling can be read, tested and deleted on its own.
