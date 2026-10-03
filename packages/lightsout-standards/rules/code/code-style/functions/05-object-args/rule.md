---
summary: "How a function takes its arguments."
checks: agent
severity: advisory
---

## Object Args

Write functions as arrow functions, unless the codebase already uses another form.

Give a function that takes arguments one object argument, and destructure it:

- An exported function declares an interface named `Params` for it.
- A private helper uses an inline object type, since one file cannot declare two `Params`.
- A function with no arguments takes no object and has no `Params`.

The one exception is a signature another contract imposes. Write it as that contract demands, and never declare it again locally:

- A callback: one passed to `map`, `reduce` or `sort`, an event handler, or a framework hook. The caller sets its shape.
- A wrapper that passes its params object on unchanged to a single function. Type it `Parameters<typeof callee>[0]`, because a copied `Params` drifts from the original.

When callers need to name the argument type, for example to build the object ahead of the call, it is public: export it as a named type in place of `Params`.

Positional arguments decay as a function grows: new ones are added out of order, middle ones can never be removed, and two of one type swap silently (`copyFile(dest, src)` compiles). A named argument says what it is at every call.
