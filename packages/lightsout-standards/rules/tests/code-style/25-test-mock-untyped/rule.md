---
summary: "Typing a mock function and the wrapper that forwards to it."
checks: deterministic
severity: blocking
---

## Test Mock Untyped

Type every `jest.fn()` to the real function's signature; read its source first. For an async function, include the `Promise`. In a `jest.mock()` factory, type the wrapper's parameters as the real function's, and forward them all:

```typescript
const mockGetProfile = jest.fn<(params: { userId: string }) => Profile | null>();

jest.mock('@/common/utils/getProfile', () => ({
	getProfile: (params: { userId: string }) => mockGetProfile(params),
}));
```

Never write `(...args: unknown[])` in a wrapper, which fails to compile (TS2556), even in a file that already does. Never write `() => mockGetProfile()` for a function that takes arguments: the spy records calls with none, and `toHaveBeenCalledWith` fails on a call that was correct.

A stub for a library's heavily generic result type, such as a query or mutation result, is exempt: stub only the fields the unit reads, and cast loosely, `as Record<string, unknown>`, or `as unknown as` the full type where it is demanded. These rules pin your contracts, not the library's, and copying its generics adds noise, not safety.
