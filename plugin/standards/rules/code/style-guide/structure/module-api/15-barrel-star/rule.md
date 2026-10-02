---
summary: "How a package's entry file lists what it publishes."
checked: true
severity: advisory
---

## Barrel Star

In a package's entry, re-export each name explicitly, `export { Foo } from '<path>'`, never with `export *`. List what other packages need, and nothing only the package itself uses.

How re-export lines wrap or merge follows the project's formatter, not this rule.

A star publishes whatever its target happens to export, so the contract stops being a decision.
