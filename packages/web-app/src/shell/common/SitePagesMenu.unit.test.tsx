import { describe, expect, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { SitePagesMenu } from '#src/shell/common/SitePagesMenu.tsx';

const setupSitePagesMenu = () => {
	render(
		<SitePagesMenu>
			<a href="/commands">Commands</a>
		</SitePagesMenu>,
	);
};

describe('SitePagesMenu', () => {
	test('keeps the pages behind the button until it is pressed', () => {
		setupSitePagesMenu();

		const menu = screen.queryByRole('navigation', { name: 'Site pages' });

		expect(menu).toBeNull();
	});

	test('opens the pages it was given when the button is pressed', () => {
		setupSitePagesMenu();

		fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
		const page = screen.getByRole('link', { name: 'Commands' });

		expect(page).toHaveAttribute('href', '/commands');
	});
});
