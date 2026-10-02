---
summary: "Naming things for what they are, not where they are used."
checked: false
severity: advisory
---

## Naming for Reuse

Name a thing by what it is, never by where or how it is used today. Ask: could someone use it elsewhere in the app without the name misleading them?

| Context-specific | Generic |
| --- | --- |
| `heroMaxWidth` | `maxContentWidth` |
| `formatPricingDate()` | `formatDate()` |
| `HeroButtonVariant` | `ButtonVariant` |

This applies to everything you extract or create. Default to the generic name. A value that is truly specific to one feature may keep a scoped name.

Narrowing a name later is free, and renaming a widely used one is expensive.
