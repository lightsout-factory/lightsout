import { describe, expect, jest, test } from '@jest/globals';
import type { StandardsPackView } from '@lightsout/engine';
import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { PacksPage } from '#src/features/packs/screens/PacksPage/PacksPage.tsx';
import { buildStandardsPackListing } from '#tests/helpers/buildStandardsPackListing.ts';
import { buildStandardsPackView } from '#tests/helpers/buildStandardsPackView.ts';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
// Every card is a link, and a link needs a live router to resolve a path. A
// plain anchor keeps the assertions about where a card points rather than about
// the routing library — with its search and hash spelled out, since a card opens
// its pack filtered to one set of rules and one link points at a doc section.
jest.mock('@tanstack/react-router', () => ({
	Link: ({
		to,
		params,
		search,
		hash,
		children,
		className,
	}: {
		to: string;
		params?: Record<string, string>;
		search?: Record<string, string>;
		hash?: string;
		children: ReactNode;
		className?: string;
	}) => {
		const path = Object.entries(params ?? {}).reduce((built, [name, value]) => built.replace(`$${name}`, value), to);
		const query = search === undefined ? '' : `?${new URLSearchParams(search).toString()}`;

		return (
			<a href={`${path}${query}${hash === undefined ? '' : `#${hash}`}`} className={className}>
				{children}
			</a>
		);
	},
}));
// -------------------------

const setupPacksPage = ({ pack = buildStandardsPackView() }: { pack?: StandardsPackView } = {}) => {
	renderWithQueryClient({ ui: <PacksPage />, seed: [{ queryKey: [QueryKey.DefaultPack], data: pack }] });
};

describe('PacksPage', () => {
	test('introduces what a Standards Pack is, in one line', () => {
		setupPacksPage();

		expect(screen.getByRole('heading', { level: 1, name: 'Standards Packs' })).toBeInTheDocument();
	});

	test("shows one card per pack of the library, each linking to that pack's page", () => {
		setupPacksPage({
			pack: buildStandardsPackView({ packs: [buildStandardsPackListing({ name: 'standards' }), buildStandardsPackListing({ name: 'react' })] }),
		});

		const headings = screen
			.getAllByRole('heading')
			.map((heading) => heading.textContent)
			.filter((text) => text !== 'Standards Packs');
		const standardsCard = screen.getByRole('link', { name: /lightsout\/standards/ });
		const reactCard = screen.getByRole('link', { name: /lightsout\/react/ });
		const ruleSetLinks = screen
			.getAllByRole('link')
			.map((link) => link.getAttribute('href'))
			.filter((href) => href?.startsWith('/standards-packs/typescript'));

		expect({
			headings,
			standardsHref: standardsCard.getAttribute('href'),
			reactHref: reactCard.getAttribute('href'),
			ruleSetLinks,
		}).toStrictEqual({
			headings: ['lightsout/standards', 'lightsout/react', 'Your team’s pack'],
			standardsHref: '/standards-packs/lightsout/packs/standards',
			reactHref: '/standards-packs/lightsout/packs/react',
			ruleSetLinks: [],
		});
	});

	// The library's own totals (1 rule, 1 checked, 0 judgment) differ from the pack's, so the counts shown prove they are the pack's.
	test('names the packs a pack includes and counts its rules by kind of check', () => {
		setupPacksPage({
			pack: buildStandardsPackView({
				packs: [
					buildStandardsPackListing({
						name: 'standards',
						include: { packs: ['lightsout/fractal'], topics: [], rules: [] },
						totals: { rules: 5, checked: 3, judgment: 2 },
					}),
				],
			}),
		});

		const card = screen.getByRole('link', { name: /lightsout\/standards/ });

		expect([
			within(card).getByText(/^Includes/).textContent,
			within(card).queryByText('3 deterministic checks') !== null,
			within(card).queryByText('2 agent checks') !== null,
		]).toStrictEqual(['Includes lightsout/fractal', true, true]);
	});

	test('leaves out the description, included packs and condition of a pack that has none of them', () => {
		setupPacksPage({
			pack: buildStandardsPackView({ packs: [buildStandardsPackListing({ name: 'standards', overrides: { description: undefined } })] }),
		});

		const card = screen.getByRole('link', { name: /lightsout\/standards/ });

		expect({
			description: within(card).queryByText('Every bundled standard at once.'),
			includes: within(card).queryByText(/^Includes/),
			condition: within(card).queryByText(/^Applies only/),
		}).toStrictEqual({ description: null, includes: null, condition: null });
	});

	test('says on a conditional pack’s card which packages it reaches', () => {
		setupPacksPage({
			pack: buildStandardsPackView({
				packs: [buildStandardsPackListing({ name: 'react', appliesWhen: { dependencies: ['react', 'preact', 'react-dom'] } })],
			}),
		});

		const card = screen.getByRole('link', { name: /lightsout\/react/ });

		expect(within(card).getByText(/^Applies only/).textContent).toBe('Applies only to packages that depend on react, preact or react-dom.');
	});

	test('shows the packs alone, with no library heading or blurb above them', () => {
		setupPacksPage();

		// the page is about the packs; the library's own description belongs to the home page
		expect(screen.queryByText('The rules lightsout ships.')).toBeNull();
		expect(screen.queryByRole('heading', { name: 'lightsout' })).toBeNull();
	});

	test('points a team at the docs for writing its own pack', () => {
		setupPacksPage();

		expect(screen.getByRole('link', { name: 'How to add your own' })).toHaveAttribute('href', '/docs/configuration#adding-your-standards');
	});
});
