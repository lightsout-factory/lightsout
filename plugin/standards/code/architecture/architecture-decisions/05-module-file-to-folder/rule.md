---
summary: "When a module should stay one file, and when it should become a folder."
checked: false
severity: advisory
---

## Modules & the Graduation Rule

A **module** is a unit of code with a public API and private internals. TypeScript enforces privacy at the file level (non-exported = invisible).

**Every concept starts as a file and earns its folder:**

- **File-module (default):** a single file holding one exported item plus non-exported helpers. The compiler enforces the boundary for free.
- **Folder-module (graduated):** when a concept needs private companions — its own utils, types, or constants that serve only it — it graduates to a folder holding the concept and its companions.
- **Born folders:** features, route modules, and screens are inherently multi-file and start as folder-modules.

**The trigger is mechanical:** *needs private companion files → folder; doesn't → file.* Never create folder ceremony for a one-file concept.

**Borderline cases are decided by the companion test:** does any of the concept's files serve only the concept itself? No → the concept is primitives; its files belong in `common/<type>/`. Yes → it is a module. This applies to shared code too: a shared concept with private companions graduates OUT of `common/` into its own module ([folder-structure.md](./folder-structure.md#what-lives-in-common--the-companion-test)).

The rule is recursive — a graduated component folder inside a feature folder is a module within a module.
