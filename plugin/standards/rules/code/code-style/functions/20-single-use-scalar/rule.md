---
summary: "Where a value used in only one place is declared."
checks: deterministic
severity: advisory
---

## Single-Use Scalar

Declare a scalar that is read in only one place where it is read, not at module scope or in a constants file: `const maxRetries = 10;` inside the function, not `const MAX_RETRIES = 10;` at the top of the module. Hoist it to module scope only when two or more places read it, or when it is a lookup map or structured config.

A value declared beside its only reader is read without a jump to find it.
