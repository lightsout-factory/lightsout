import { describe, expect, jest, test } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DocPage } from '#src/features/docs/screens/DocPage/DocPage.tsx';

// Mocked Imports
// -------------------------
// The docs list links each doc by route, and a link needs a live router to
// resolve a path. A plain anchor keeps the assertions about where it points.
jest.mock('@tanstack/react-router', () => ({
	Link: ({ to, params, children, className, ...rest }: { to: string; params?: Record<string, string>; children: ReactNode; className?: string }) => (
		<a href={Object.entries(params ?? {}).reduce((path, [name, value]) => path.replace(`$${name}`, value), to)} className={className} {...rest}>
			{children}
		</a>
	),
}));
// -------------------------

const setupDocPage = ({ doc = 'configuration' }: { doc?: string } = {}) => {
	const { container } = render(<DocPage doc={doc} />);

	return { container };
};

/**
 * The heading list. The page carries it twice — folded above the article on a
 * narrow screen, beside it on a wide one — and CSS shows one; both copies are
 * the same list, so the first stands for either.
 */
const readToc = () => within(screen.getAllByRole('navigation', { name: 'On this page' })[0] as HTMLElement);

describe('DocPage', () => {
	test('names the page after the document rather than after the route param the reader typed', () => {
		setupDocPage({ doc: 'configuration' });

		const title = screen.getByRole('heading', { level: 1, name: 'Configuration' });

		expect(title).toBeInTheDocument();
	});

	test('serves the second document the site carries as well as the first', () => {
		setupDocPage({ doc: 'monorepos' });

		const title = screen.getByRole('heading', { level: 1, name: 'Monorepos' });

		expect(title).toBeInTheDocument();
	});

	test('renders nothing at all for a name no document answers to, rather than throwing', () => {
		const { container } = setupDocPage({ doc: 'no-such-doc' });

		expect(container).toBeEmptyDOMElement();
	});

	test('renders the document itself and not only its outline', () => {
		setupDocPage({ doc: 'monorepos' });

		const body = screen.getByText(/Whole-repository gates can make monorepo runs slower/);

		expect(body).toBeInTheDocument();
	});

	test('links a heading in the list to the anchor the rendered heading carries, so the link lands', () => {
		setupDocPage({ doc: 'configuration' });

		const entry = readToc().getByRole('link', { name: 'Minimal setup' });

		expect(entry).toHaveAttribute('href', '#minimal-setup');
		expect(document.getElementById('minimal-setup')).toBe(screen.getByRole('heading', { level: 2, name: 'Minimal setup' }));
	});

	test('lists a heading that spells a word in code without its backticks, and still lands on it', () => {
		setupDocPage({ doc: 'configuration' });

		const entry = readToc().getByRole('link', { name: 'Recommended .gitignore' });

		expect(entry).toHaveAttribute('href', '#recommended-gitignore');
	});

	test('lists the headings in the order the document writes them', () => {
		setupDocPage({ doc: 'configuration' });

		const entries = readToc().getAllByRole('link');

		expect(entries.slice(0, 3).map((entry) => entry.textContent)).toStrictEqual(['Minimal setup', 'Common configurations', 'Use the built-in code standards']);
	});

	test('indents a third-level heading under the second-level one it sits beneath', () => {
		setupDocPage({ doc: 'configuration' });

		const entries = readToc();

		expect(entries.getByRole('link', { name: 'Use your own standards' }).className).toContain('pl-6');
		expect(entries.getByRole('link', { name: 'Common configurations' }).className).not.toContain('pl-6');
	});

	test('lists only the levels it can link to, leaving the document title out of its own outline', () => {
		setupDocPage({ doc: 'monorepos' });

		const entries = readToc().getAllByRole('link');

		expect(entries.map((entry) => entry.textContent)).toStrictEqual(['How package gates work', 'Standards per package']);
	});

	test('shows the title once, lifting the document’s own opening heading out of its body', () => {
		setupDocPage({ doc: 'configuration' });

		const titles = screen.getAllByRole('heading', { name: 'Configuration' });

		expect(titles).toHaveLength(1);
	});

	test('lists every doc the site carries, marking the one on the page as current', () => {
		setupDocPage({ doc: 'monorepos' });
		const docs = within(screen.getByRole('navigation', { name: 'Docs' }));

		const links = docs.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href'), link.getAttribute('aria-current')]);

		expect(links).toStrictEqual([
			['Configuration', '/docs/configuration', null],
			['Monorepos', '/docs/monorepos', 'page'],
		]);
	});

	test('points a link to another doc’s markdown file at that doc’s page on the site', () => {
		setupDocPage({ doc: 'configuration' });

		const link = within(screen.getByRole('article')).getByRole('link', { name: 'Monorepos' });

		expect(link).toHaveAttribute('href', '/docs/monorepos');
	});
});
