import { describe, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { RootDocument } from '#src/shell/RootDocument.tsx';

// Mocked Imports
// -------------------------
// Both read the live router's match; outside one they have nothing to render.
jest.mock('@tanstack/react-router', () => ({ HeadContent: () => null, Scripts: () => null }));
// -------------------------

const setupRootDocument = () => {
	render(
		<RootDocument>
			<p>the open route</p>
		</RootDocument>,
	);
};

describe('RootDocument', () => {
	test('renders the page as an English HTML document', () => {
		setupRootDocument();

		const page = document.querySelector('html[lang="en"]');

		expect(page).toBeInTheDocument();
	});

	test('sends that document light, so a first-time reader never sees the dark theme flash past', () => {
		setupRootDocument();

		const page = document.querySelector('html[lang="en"]');

		expect(page?.className.split(' ')).toContain('light');
	});

	test('swaps to the stored dark theme before the stylesheet applies, through a script the server can send blind', () => {
		setupRootDocument();

		const script = document.querySelector('script')?.textContent ?? '';

		expect(script).toContain("localStorage.getItem('lightsout-theme')");
	});

	test('puts whichever route is open inside that document', () => {
		setupRootDocument();

		const open = screen.getByText('the open route');

		expect(open).toBeInTheDocument();
	});
});
