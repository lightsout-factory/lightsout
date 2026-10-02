---
summary: "Code that several packages need."
checked: false
severity: advisory
---

## Cross-Package Sharing

Never copy code from one package into another. Code that `shared-package-criteria` lets into a shared package goes there instead of a copy in each package.

A shared package where everything is public is like a `common/`: its `src/` holds domain folders, not modules. Decide each folder as `module-out-of-common` does: a folder whose every file is something its users call directly is a domain folder.

Copies in each package drift apart, and a fix then reaches only one of them.
