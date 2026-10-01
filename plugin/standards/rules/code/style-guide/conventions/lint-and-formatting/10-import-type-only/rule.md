---
summary: "Imports that are only used as types."
checked: true
severity: blocking
---

## Import Type Only

Import with `import type` anything used only as a type: in annotations, parameter types or generic arguments. It is then erased at compile time.

On a decorated declaration, import the names it references as values: a decorated class's constructor parameters, a decorated method's parameters, and a decorated property's type. Decorator metadata reads those names at runtime, for dependency injection and validation, so `import type` there is the bug, not the fix.
