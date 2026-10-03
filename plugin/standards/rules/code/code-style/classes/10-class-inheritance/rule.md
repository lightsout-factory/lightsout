---
summary: "Sharing behaviour between classes."
checks: deterministic
severity: advisory
---

## Class Inheritance

Never share behaviour through `extends`. Share by composition: hold the common part as a value the composer creates and passes in, and delegate to it. State contracts as interfaces; `implements` is not inheritance.

- `Error` is the one base you may extend, including an error family such as `extends HttpError`, because subclassing is the only way to make a typed error that `instanceof` can check.
- When a framework's contract is a base class, extending it is allowed. Treat a decorated class as framework-owned.

A base class couples every subclass to its internals: a change or an override acts at a distance, and what is shared hides in a second file.
