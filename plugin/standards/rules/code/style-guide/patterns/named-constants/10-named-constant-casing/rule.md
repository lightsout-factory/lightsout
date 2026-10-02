---
summary: "How named constants and plain constants are cased."
checked: false
severity: advisory
---

## Named Constant Casing

A named constant is a `const` object with a union type derived from it, such as `Action` or `LogLevel`. Name it in PascalCase, because the object and its type share one name and a type is PascalCase.

Every other constant is a value constant and is camelCase: a single value such as `maxRetries` or `emailRegex`, or an object that groups related values such as `featureThresholds`.
