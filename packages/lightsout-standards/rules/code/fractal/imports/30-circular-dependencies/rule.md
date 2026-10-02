---
summary: "Modules that depend on each other."
checked: false
severity: advisory
---

## Circular Dependencies

Never let two modules import each other. Move the piece they share, usually a type, into a third module both import, or move code as `shared-code-placement` says.

A cycle makes load order fragile and breaks tree-shaking.
