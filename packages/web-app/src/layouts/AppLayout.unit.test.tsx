import { describe, expect, jest, test } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppLayout } from '#src/layouts/AppLayout.tsx';
import { ThemeProvider } from '#src/providers/ThemeProvider.tsx';
import { repoRootQueryOptions } from '#src/queries/repoRootQueryOptions.ts';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
jest.mock('@tanstack/react-router', () => ({
	Link: ({ to, children, className, 'aria-label': ariaLabel }: { to: string; children: ReactNode; className?: string; 'aria-label'?: string }) => (
		<a href={to} className={className} aria-label={ariaLabel}>
			{children}
		</a>
	),
	Outlet: () => <p>the open route</p>,
}));
// -------------------------

const setupAppLayout = ({ repoRoot = '/repos/lightsout' }: { repoRoot?: string } = {}) => {
	renderWithQueryClient({
		ui: (
			<ThemeProvider>
				<AppLayout />
			</ThemeProvider>
		),
		seed: [{ queryKey: repoRootQueryOptions().queryKey, data: { repoRoot } }],
	});
};

describe('AppLayout', () => {
	test('carries the site bar on every page', () => {
		setupAppLayout();

		const site = screen.getByRole('navigation', { name: 'Site' });

		expect(site).toBeInTheDocument();
	});

	test('offers the local zone, and names it', () => {
		setupAppLayout({ repoRoot: '/repos/other-project' });

		const zone = screen.getByRole('navigation', { name: 'Your repo' });

		expect(zone).toBeInTheDocument();
	});

	test('renders the open route beside that navigation', () => {
		setupAppLayout();

		const outlet = screen.getByText('the open route');

		expect(outlet).toBeInTheDocument();
	});

	test('sends the wordmark back to the landing page', () => {
		setupAppLayout();

		const wordmark = screen.getByRole('link', { name: 'lightsout' });

		expect(wordmark).toHaveAttribute('href', '/');
	});

	test('offers the commands page, now that it is built', () => {
		setupAppLayout();

		const commands = screen.getAllByRole('link', { name: 'Commands' });

		expect(commands[0]).toHaveAttribute('href', '/commands');
	});

	test('opens the site pages in a sheet when the menu button is pressed, which is how a narrow screen reaches them', () => {
		setupAppLayout();

		const menuButton = screen.getByRole('button', { name: 'Open menu' });
		fireEvent.click(menuButton);

		const sheet = screen.getByRole('navigation', { name: 'Site pages' });

		expect(sheet).toHaveTextContent('Commands');
	});

	test('leaves the sheet closed until the menu button is pressed', () => {
		setupAppLayout();

		const sheet = screen.queryByRole('navigation', { name: 'Site pages' });

		expect(sheet).not.toBeInTheDocument();
	});

	test('says which repo the local zone reads, and keeps the full path as a tooltip because the column truncates it', () => {
		setupAppLayout({ repoRoot: '/repos/other-project' });

		const path = screen.getByText('/repos/other-project');

		expect(path).toHaveAttribute('title', '/repos/other-project');
	});

	test('points the local zone at the repo pages, which now live under /app', () => {
		setupAppLayout();

		const runs = screen.getByRole('link', { name: 'Runs' });
		const standards = screen.getByRole('link', { name: 'Standards' });

		expect([runs.getAttribute('href'), standards.getAttribute('href')]).toEqual(['/app/runs', '/app/standards']);
	});

	test('offers the source repository as an outward link that leaves the app', () => {
		setupAppLayout();

		const github = screen.getByRole('link', { name: 'GitHub' });

		expect(github).toHaveAttribute('href', 'https://github.com/lightsout-factory/lightsout');
		expect(github).toHaveAttribute('target', '_blank');
	});
});
