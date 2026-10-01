---
summary: "The shape of a single test."
checked: false
severity: advisory
---

## Test Structure: Arrange-Act-Assert with Setup Factories

Write every test as arrange, act, assert. Arrange in one named setup factory; the test body calls it, acts and asserts.

```typescript
describe('getAvatarUrl', () => {
	test('returns the profile avatar when one exists', () => {
		const { userProfile, appSettings } = setupAvatar({ profile: 'p.png' });

		const avatarUrl = getAvatarUrl({ userProfile, appSettings });

		expect(avatarUrl).toBe('p.png');
	});
});
```

- Act once per test: two acts make two tests. Use several `expect`s only when they assert one behaviour's result, and prefer one `expect` for several properties of one result.
- Assign each call in the act to a named `const`; never nest one call in another. The act sits inside the assertion only for an error, `expect(() => parse(bad)).toThrow()` or `await expect(load()).rejects.toThrow()`. A matcher may compose another, as in `toEqual(expect.objectContaining(...))`.
- Separate arrange, act and assert with a blank line, and write no `// arrange`, `// act` or `// assert` comments.
- Cover every code path: branches, error handling and boundary conditions. Give each path one test, and never add a test that only varies the input. Inputs that take one path to different outputs share one `test.each`.
- To reach a branch that guards against input the types forbid, such as a `default` arm or an early return on an impossible discriminant, force the input with `as unknown as T`. That and the framework stub cast `test-mock-untyped` allows are the only casts a test writes.
- Import the test functions first: `import { expect, describe, test, jest } from '@jest/globals';`. Import `jest` only when the file uses `jest.fn`, `jest.mock` or `jest.spyOn`, and `beforeEach`, `afterEach` or `afterAll` only when you need one; with setup factories and config-level mock cleanup, most files need none.
