---
summary: "What each part of a doc comment should say."
checked: false
severity: advisory
---

## Doc Elements

- **Description:** one or two sentences on what it does and why you'd use it. Focus on why; the code shows what.
- **`@param`:** the name and its purpose only, because TypeScript owns the type. For a function that takes one object argument (`object-args`), name the destructured properties directly. Write lowercase sentence fragments.
- **`@throws`:** only for an error thrown on purpose and expected to be caught: `@throws {ConnectionError} When the database is unreachable`.
- **`@returns`:** only when the value means more than its type shows, such as a `string` that is a JWT, or a `boolean` whose `true` means "already existed".
- **`@example`:** for a complex API or usage that isn't obvious. Keep it minimal and runnable.
- **`@typeParam`:** when a generic's purpose isn't obvious from its name.
- **Interface properties:** document an interface, other than a `Params` interface (`params-interface-docs`), at the type level, not on every property. Comment a property only when its name and type don't convey the contract: `/** Display name shown in the UI, may differ from username */`.

```typescript
interface Params<T> {
	fn: () => Promise<T>;
	maxAttempts?: number;
	baseDelay?: number;
}

/**
 * Retries an async operation with exponential backoff, for network requests that may fail transiently.
 *
 * @param fn - async function to retry
 * @param maxAttempts - attempts before giving up
 * @param baseDelay - initial delay in ms, doubles after each failure
 * @throws {RetryExhaustedError} When all retry attempts fail
 */
export const retry = async <T>({ fn, maxAttempts = 3, baseDelay = 1000 }: Params<T>): Promise<T> => {
	// ...
};
```
