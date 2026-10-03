---
summary: "Typing a mock function."
checks: deterministic
severity: blocking
---

## Test Mock Untyped

Type every `jest.fn()` to the real function's signature; read its source first. For an async function, include the `Promise`.

```typescript
const mockGetProfile = jest.fn<(params: { userId: string }) => Profile | null>();
```

A stub for a framework's heavily generic result type, such as TanStack's `UseMutationResult` or `UseQueryResult`, is exempt: stub only the fields the unit reads, and cast loosely, `as Record<string, unknown>`, or `as unknown as UseMutationResult<…>` where the full type is demanded. These rules pin your contracts, not the framework's, and copying its generics adds noise, not safety.
