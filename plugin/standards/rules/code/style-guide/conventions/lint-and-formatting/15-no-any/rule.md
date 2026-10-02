---
summary: "Avoiding the type that switches type checking off."
checked: true
severity: blocking
---

## No Any

Never use `any`. When a type is genuinely unknown, use `unknown` and narrow it with type guards. When it is not, write the specific type or a generic. A rare, justified exception gets the project's lint-suppression comment, with the reason.

`any` switches type checking off for everything it touches.
