---
summary: "How a function takes its arguments."
checks: agent
severity: advisory
---

## Object Args

Give a function that takes arguments one object argument, and destructure it:

- An exported function declares an interface named `Params` for it.
- A private helper uses an inline object type, since one file cannot declare two `Params`.
- A function with no arguments takes no object and has no `Params`.

Two signatures follow a contract set elsewhere, and are never declared again locally: a callback, whose caller sets its shape, and a wrapper that passes its params object on unchanged, typed `Parameters<typeof callee>[0]`.

When callers need to name the argument type, export it as a named type in place of `Params`.

Positional arguments decay as a function grows: new ones are added out of order, and two of one type swap silently (`copyFile(dest, src)` compiles). A named argument says what it is at every call.
