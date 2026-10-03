---
summary: "Where a component test renders and queries."
checks: agent
severity: advisory
---

## The Render Pattern

Render inside the `setup()` factory; query and assert in the `test`. For a component, `render()` *is* the act, but by convention it lives in the arrange factory — the one accepted exception to "the act lives in the `test`". Query from `screen` — never destructure queries from `render()`.

In a test of an interaction, the query that finds the element to act on groups with the act, the `userEvent` or `fireEvent` call, not with arrange.

```typescript
import { expect, describe, test, jest } from '@jest/globals';
import { render, screen } from '@testing-library/preact';
import { NotificationBanner } from './NotificationBanner';

// Mocked Imports
// -------------------------
const mockUseAppStore = jest.fn<(selector: (state: unknown) => unknown) => unknown>();

jest.mock('@store/appStore', () => ({
	useAppStore: (selector: (state: unknown) => unknown) => mockUseAppStore(selector),
}));
// -------------------------

const setupNotificationBanner = ({ isVisible = true }: { isVisible?: boolean } = {}) => {
	const onDismiss = jest.fn<() => void>();
	mockUseAppStore.mockReturnValue(isVisible);
	render(<NotificationBanner onDismiss={onDismiss} />);

	return { onDismiss };
};

describe('NotificationBanner', () => {
	test('does not render the banner when not visible', () => {
		setupNotificationBanner({ isVisible: false });

		const banner = screen.queryByRole('alert');

		expect(banner).not.toBeInTheDocument();
	});

	test('renders the notification message when visible', () => {
		setupNotificationBanner({ isVisible: true });

		const message = screen.getByText('Action required');

		expect(message).toBeInTheDocument();
	});
});
```
