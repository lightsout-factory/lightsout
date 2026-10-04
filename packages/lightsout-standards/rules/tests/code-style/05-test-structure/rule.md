---
summary: "The shape of a single test."
checks: agent
severity: advisory
---

## Test Structure

Write every test as arrange, act, assert. Arrange in one named setup factory; the test body calls it, acts and asserts.

```typescript
import { expect, describe, test, jest } from '@jest/globals';
import { UserProfile } from '@/profiles/UserProfile';
import { AppSettings } from '@/settings/AppSettings';
import { getAvatarUrl } from '@/avatars/getAvatarUrl';

const mockGetAvatarFromProfile = jest.fn<(params: { profile: UserProfile }) => string | null>();

jest.mock('@/profiles/getAvatarFromProfile', () => ({
	getAvatarFromProfile: (params: { profile: UserProfile }) => mockGetAvatarFromProfile(params),
}));

const setupAvatar = ({ profile = null }: { profile?: string | null } = {}) => {
	mockGetAvatarFromProfile.mockReturnValue(profile);
	const userProfile = new UserProfile({ profileData: { email: 'user@example.com' } });
	const appSettings = new AppSettings({ defaultPreferences: {} });

	return { userProfile, appSettings };
};

describe('getAvatarUrl', () => {
	test('returns the profile avatar when one exists', () => {
		const { userProfile, appSettings } = setupAvatar({ profile: 'p.png' });

		const avatarUrl = getAvatarUrl({ userProfile, appSettings });

		expect(avatarUrl).toBe('p.png');
	});
});
```

- The setup factory takes the test's variants as parameters with defaults, wires the mocks, builds the fixtures, and returns the locals the test needs as `const`s. One factory configures any number of mocks, and one call is the whole arrangement.
- A test may override the one value it varies with a single line after the call, such as one `mockReturnValue`.
- For a class, the factory returns the constructor's collaborators, and the test's act constructs the instance.
- Act once per test: two acts make two tests. Use several `expect`s only when they assert one behaviour's result, and prefer one `expect` for several properties of one result.
- Assign each call in the act to a named `const`; never nest one call in another. The act sits inside the assertion only for an error, `expect(() => parse(bad)).toThrow()` or `await expect(load()).rejects.toThrow()`. A matcher may compose another, as in `toEqual(expect.objectContaining(...))`.
- Separate arrange, act and assert with a blank line, and write no `// arrange`, `// act` or `// assert` comments.
