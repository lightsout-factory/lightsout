---
summary: "When code needs a comment."
checked: false
severity: advisory
---

## When to Document

Default to self-documenting code. Add a doc comment whenever one of these holds:

- The why is not obvious: business context, constraints, or gotchas a reader wouldn't guess from the code.
- The function has a complex contract: parameters that interact in ways that aren't obvious, errors it throws on purpose, or usage worth an example.
- The export is a public API that other packages or external callers use. They read the comment on hover, without the source beside it.

When none holds, skip the comment if the name and types already say what it is for.

In a doc comment, leave out what the types already say:

- `@param`: the name and its purpose only. TypeScript owns the type.
- `@throws`: only for an error thrown on purpose and expected to be caught.
- `@returns`: only when the value means more than its type shows, such as a `string` that is a JWT.

Write no inline `//` comments, except for a workaround that isn't obvious, a business rule inside the logic (`// 30-day window per billing agreement`), or a deliberate deviation and its reason. Never narrate what the next line does.
