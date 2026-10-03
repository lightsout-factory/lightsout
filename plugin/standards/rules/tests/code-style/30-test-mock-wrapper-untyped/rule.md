---
summary: "How a module mock forwards its arguments."
checks: deterministic
severity: blocking
---

## Test Mock Wrapper Untyped

In a `jest.mock()` factory, type the wrapper's parameters as the real function's, and forward them all:

```typescript
jest.mock('@/common/utils/getProfile', () => ({
	getProfile: (params: { userId: string }) => mockGetProfile(params),
}));
```

Never write `(...args: unknown[])`, which fails to compile (TS2556), even in a file that already does. Never write `() => mockGetProfile()` for a function that takes arguments: the spy records calls with none, and `toHaveBeenCalledWith` fails on a call that was correct.
