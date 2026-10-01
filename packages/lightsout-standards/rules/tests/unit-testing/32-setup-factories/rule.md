---
summary: "How a setup factory is written."
checked: false
severity: advisory
---

## Setup Factories

A setup factory takes the test's variants as parameters with defaults, wires the mocks, builds the fixtures, and returns the locals the test needs as `const`s:

```typescript
const setupAvatar = ({
	profile = null,
	gravatar = null,
}: { profile?: string | null; gravatar?: string | null } = {}) => {
	mockGetAvatarFromProfile.mockReturnValue(profile);
	mockGetAvatarFromGravatar.mockReturnValue(gravatar);

	const userProfile = new UserProfile({ profileData: { email: 'user@example.com' } });
	const appSettings = new AppSettings({ defaultPreferences: {} });

	return { userProfile, appSettings };
};
```

- One factory configures any number of mocks, and one call is the whole arrangement.
- A test may override the one value it varies with a single line after the call, such as one `mockReturnValue`.
- For a class, the factory returns the constructor's collaborators, and the test's act constructs the instance.
