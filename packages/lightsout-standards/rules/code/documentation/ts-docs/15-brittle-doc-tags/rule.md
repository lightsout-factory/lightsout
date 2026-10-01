---
summary: "Doc comment tags that other tools already track."
checked: true
severity: blocking
---

## Brittle Doc Tags

In a TypeScript file's doc comments, never use these tags:

- `@version`, `@since` or `@author`: git records them.
- `@type`, `@default`, `@readonly`, `@private`, `@public`, `@protected` or `@memberof`: TypeScript states them.
- `@see` with a URL: write `@see {@link SymbolName}` instead.
- `@todo`: the issue tracker holds it.
- `@deprecated` without a migration path.

A tag that copies what another tool records goes stale when that record changes.
