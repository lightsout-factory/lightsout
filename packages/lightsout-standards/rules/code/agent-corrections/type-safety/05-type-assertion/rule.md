---
summary: "Telling the compiler a type instead of proving it."
checked: true
severity: blocking
---

## Type Assertion

Never write an `as` cast in source code. A cast tells the compiler to trust you instead of proving the type. Narrow instead, with `typeof`, `instanceof` or a discriminated union. When a value cannot be narrowed where it is used, such as a value of type `unknown` from a library, write a type guard or a validation function for it.

This includes text arriving at a boundary, such as a JSON payload, a query parameter or a database value: a string is not yet a member of a named constant's union, so convert it with a small validation function, such as `parseAction`, never `as Action`.

`as const` is not a cast: it fixes a literal's type, and it stays.

```typescript
// Incorrect: the compiler takes your word for it
return (value as string).toUpperCase();

// Correct: the check proves it
if (typeof value === 'string') {
	return value.toUpperCase();
}
```
