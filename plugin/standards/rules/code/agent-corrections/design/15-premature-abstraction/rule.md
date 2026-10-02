---
summary: "When to turn similar code into something general."
checked: false
severity: advisory
---

## Premature Abstraction

Never generalise code for a use that does not exist yet: no option, parameter or layer for an imagined case. Build it when a second real use needs it.

This covers code that is similar but not yet the same. Code that is already identical is shared from the second copy.

The right abstraction shows itself in real use, and a wrong one is worse than duplication.
