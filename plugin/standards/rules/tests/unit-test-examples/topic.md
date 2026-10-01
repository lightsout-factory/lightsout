# Unit Test Examples

Two complete tests, showing the unit-testing rules applied end to end.

## Function with Mocked Dependencies

```typescript
import { expect, describe, test, jest } from '@jest/globals';
import { UserProfile } from '@/profiles/UserProfile';
import { AppSettings } from '@/settings/AppSettings';
import { getAvatarUrl } from '@/avatars/getAvatarUrl';

// Mocked Imports
// -------------------------
const mockGetAvatarFromProfile = jest.fn<(params: { profile: UserProfile }) => string | null>();

jest.mock('@/profiles/getAvatarFromProfile', () => ({
	getAvatarFromProfile: (params: { profile: UserProfile }) =>
		mockGetAvatarFromProfile(params),
}));
// -------------------------
const mockGetAvatarFromGravatar = jest.fn<(params: { email: string }) => string | null>();

jest.mock('@/gravatar/getAvatarFromGravatar', () => ({
	getAvatarFromGravatar: (params: { email: string }) =>
		mockGetAvatarFromGravatar(params),
}));
// -------------------------

const setupAvatar = ({
	profile = null,
	gravatar = null,
	setting,
}: {
	profile?: string | null;
	gravatar?: string | null;
	setting?: 'hasCustomAvatar' | 'useGravatar';
} = {}) => {
	mockGetAvatarFromProfile.mockReturnValue(profile);
	mockGetAvatarFromGravatar.mockReturnValue(gravatar);

	const userProfile = new UserProfile({
		profileData: { email: 'user@example.com', displayName: 'Test User' },
	});
	const appSettings = new AppSettings({ isGuest: false, defaultPreferences: {} });
	if (setting) {
		appSettings.set(setting, true);
	}

	return { userProfile, appSettings };
};

describe('getAvatarUrl', () => {
	test('returns null when no avatar conditions are met', () => {
		const { userProfile, appSettings } = setupAvatar();

		const avatarUrl = getAvatarUrl({ userProfile, appSettings });

		expect(avatarUrl).toBeNull();
	});

	test('returns the profile avatar when the user has a custom avatar', () => {
		const { userProfile, appSettings } = setupAvatar({
			profile: 'https://cdn.example.com/avatars/user-123.png',
			setting: 'hasCustomAvatar',
		});

		const avatarUrl = getAvatarUrl({ userProfile, appSettings });

		expect(avatarUrl).toBe('https://cdn.example.com/avatars/user-123.png');
	});
});
```

## Parameterized with test.each

```typescript
import { expect, describe, test } from '@jest/globals';
import { formatCurrency } from '@/common/utils/formatCurrency';

describe('formatCurrency', () => {
	test.each([
		{ amount: 100, locale: 'en-US', expected: '$1.00' },
		{ amount: 100, locale: 'en-GB', expected: '£1.00' },
		{ amount: 0, locale: 'en-US', expected: '$0.00' },
		{ amount: -50, locale: 'en-US', expected: '-$0.50' },
	])(
		'formats $amount in $locale as $expected',
		({ amount, locale, expected }) => {
			const formatted = formatCurrency({ amount, locale });

			expect(formatted).toBe(expected);
		},
	);
});
```
