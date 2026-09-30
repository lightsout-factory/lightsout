import { describe, expect, jest, test } from '@jest/globals';
import type { StandardsTopicView } from '@lightsout/engine';
import { StandardsSet, StandardsSeverity } from '@lightsout/engine/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import type { PackRuleFilters } from '#src/features/packs/screens/PackPage/internal/common/types/PackRuleFilters.ts';
import { PackPage } from '#src/features/packs/screens/PackPage/PackPage.tsx';
import { buildStandardsPackListing } from '#tests/helpers/buildStandardsPackListing.ts';
import { buildStandardsPackRuleListing } from '#tests/helpers/buildStandardsPackRuleListing.ts';
import { buildStandardsPackView } from '#tests/helpers/buildStandardsPackView.ts';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
// Every rule, every included pack and the trail are links, and a link needs a
// live router to resolve a path. A plain anchor keeps the assertions about
// where each points.
jest.mock('@tanstack/react-router', () => ({
	Link: ({ to, params, children, className }: { to: string; params?: Record<string, string>; children: ReactNode; className?: string }) => (
		<a href={Object.entries(params ?? {}).reduce((path, [name, value]) => path.replace(`$${name}`, value), to)} className={className}>
			{children}
		</a>
	),
}));
// -------------------------

/** Each intro's heading differs from the title its folder name would give, so a title shown proves the intro was read. */
const topics: StandardsTopicView[] = [
	{
		set: StandardsSet.Code,
		path: 'code/architecture/folder-structure',
		intro: '# Folder Structure\n\nWhere things live.',
		ruleIds: ['folder-size', 'folder-depth'],
	},
	{ set: StandardsSet.Code, path: 'code/style-guide/conventions/casing', intro: '# Casing Conventions', ruleIds: ['casing'] },
	{ set: StandardsSet.Code, path: 'code/architecture/react', intro: '# React Architecture', ruleIds: ['component-file-structure'] },
	{ set: StandardsSet.Tests, path: 'tests/test-files', intro: '# Test Files', ruleIds: ['test-file-location'] },
];

const rules = [
	buildStandardsPackRuleListing({ id: 'folder-size', documentPath: 'code/architecture/folder-structure', summary: 'a folder holding too many things' }),
	buildStandardsPackRuleListing({ id: 'folder-depth', documentPath: 'code/architecture/folder-structure', summary: 'a folder tree spelled out too deep' }),
	buildStandardsPackRuleListing({
		id: 'casing',
		documentPath: 'code/style-guide/conventions/casing',
		summary: 'a name spelled in the wrong case',
		checked: false,
		defaultSeverity: StandardsSeverity.Advisory,
	}),
	buildStandardsPackRuleListing({
		id: 'component-file-structure',
		documentPath: 'code/architecture/react',
		summary: 'a component file laid out of order',
		checked: false,
	}),
	buildStandardsPackRuleListing({
		id: 'test-file-location',
		set: StandardsSet.Tests,
		documentPath: 'tests/test-files',
		summary: 'a test file kept away from its source',
	}),
];

/**
 * Pack `app` holds one rule from each of two topics, raises `casing` above its
 * advisory default, and brings in the react topic with its one rule removed —
 * a topic left empty. Pack `base` holds only the folder-structure topic, and
 * pack `unit-testing` only the tests topic.
 */
const packs = [
	buildStandardsPackListing({
		name: 'app',
		description: 'The rules an app package runs.',
		include: { packs: ['lightsout/base', 'acme/house'], topics: ['lightsout/code/style-guide/conventions/casing'], rules: [] },
		topics: ['lightsout/code/architecture/folder-structure', 'lightsout/code/architecture/react', 'lightsout/code/style-guide/conventions/casing'],
		rules: [
			{ name: 'lightsout/casing', severity: StandardsSeverity.Blocking, options: {} },
			{ name: 'lightsout/folder-size', severity: StandardsSeverity.Blocking, options: {} },
		],
		totals: { checked: 1, judgment: 1 },
	}),
	buildStandardsPackListing({
		name: 'base',
		include: { packs: [], topics: ['lightsout/code/architecture/folder-structure'], rules: [] },
		topics: ['lightsout/code/architecture/folder-structure'],
		rules: [
			{ name: 'lightsout/folder-depth', severity: StandardsSeverity.Blocking, options: {} },
			{ name: 'lightsout/folder-size', severity: StandardsSeverity.Blocking, options: {} },
		],
	}),
	buildStandardsPackListing({
		name: 'unit-testing',
		include: { packs: [], topics: ['lightsout/tests/test-files'], rules: [] },
		topics: ['lightsout/tests/test-files'],
		rules: [{ name: 'lightsout/test-file-location', severity: StandardsSeverity.Blocking, options: {} }],
	}),
];

/** The lightsout library as the pages read it: five rules in four topics, and three packs. Its totals (5, 3, 2) differ from pack `app`'s (2, 1, 1). */
const library = buildStandardsPackView({ rules, topics, packs });

const setupPackPage = ({ pack = 'app', filters = {} }: { pack?: string; filters?: PackRuleFilters } = {}) => {
	const onFiltersChange = jest.fn<(filters: PackRuleFilters) => void>();

	renderWithQueryClient({
		ui: <PackPage pack={pack} filters={filters} onFiltersChange={onFiltersChange} />,
		seed: [{ queryKey: [QueryKey.DefaultPack], data: library }],
	});

	return { onFiltersChange };
};

/** The rule list's group headings, in page order, without their counts. */
const readGroupTitles = () => screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.firstChild?.textContent);

/** The header's figures, each as `<label>: <value>`. */
const readFigures = () => screen.getAllByRole('term').map((term) => `${term.textContent}: ${term.nextElementSibling?.textContent}`);

/** Where every rule row on the page points, in page order. */
const readRuleLinks = () =>
	screen
		.getAllByRole('link')
		.map((link) => link.getAttribute('href'))
		.filter((href) => href?.includes('/rules/'));

/** Where the rule rows inside one topic's section point. */
const readSectionRuleLinks = ({ title }: { title: RegExp }) =>
	within(screen.getByRole('region', { name: title }))
		.getAllByRole('link')
		.map((link) => link.getAttribute('href'));

describe('PackPage', () => {
	test('shows the trail back to every pack above the pack, with the pack as the page already open', () => {
		setupPackPage();

		const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
		const packsLink = within(trail).getByRole('link', { name: 'Standards Packs' });

		expect({ text: trail.textContent, link: packsLink.getAttribute('href') }).toStrictEqual({
			text: 'Standards Packslightsout/app',
			link: '/standards-packs',
		});
	});

	test('names the pack by its address, with its description', () => {
		setupPackPage();

		const heading = screen.getByRole('heading', { level: 1 });
		const description = screen.queryByText('The rules an app package runs.');

		expect({ heading: heading.textContent, hasDescription: description !== null }).toStrictEqual({ heading: 'lightsout/app', hasDescription: true });
	});

	test('counts the pack’s own rules, and how many are deterministic checks and how many agent checks', () => {
		setupPackPage();

		const figures = readFigures();

		expect(figures).toStrictEqual(['Rules: 2', 'Deterministic checks: 1', 'Agent checks: 1']);
	});

	test('shows only the rules the pack holds, grouped under their topics', () => {
		setupPackPage();

		const titles = readGroupTitles();
		const folderStructure = readSectionRuleLinks({ title: /^Folder Structure/ });
		const casing = readSectionRuleLinks({ title: /^Casing Conventions/ });
		const everyRule = readRuleLinks();

		expect({ titles, folderStructure, casing, everyRule }).toStrictEqual({
			titles: ['Folder Structure', 'Casing Conventions'],
			folderStructure: ['/standards-packs/lightsout/rules/folder-size'],
			casing: ['/standards-packs/lightsout/rules/casing'],
			everyRule: ['/standards-packs/lightsout/rules/folder-size', '/standards-packs/lightsout/rules/casing'],
		});
	});

	test('says each rule’s kind of check', () => {
		setupPackPage();

		const row = screen.getByRole('link', { name: /^casing/ });

		expect(within(row).queryByText('Agent')).not.toBeNull();
	});

	test('shows each rule at the severity the pack sets', () => {
		setupPackPage();

		const row = screen.getByRole('link', { name: /^casing/ });

		expect({ blocks: within(row).queryByText('Blocks') !== null, advises: within(row).queryByText('Advises') !== null }).toStrictEqual({
			blocks: true,
			advises: false,
		});
	});

	test('links each included pack of the same library to its page', () => {
		setupPackPage();

		const samePack = screen.getByRole('link', { name: 'lightsout/base' });
		const foreignPackLink = screen.queryByRole('link', { name: 'acme/house' });
		const foreignPackText = screen.queryByText('acme/house');

		expect({
			samePack: samePack.getAttribute('href'),
			foreignPackLinked: foreignPackLink !== null,
			foreignPackShown: foreignPackText !== null,
		}).toStrictEqual({ samePack: '/standards-packs/lightsout/packs/base', foreignPackLinked: false, foreignPackShown: true });
	});

	// `folder-depth` also matches "spelled", but pack `app` does not hold it.
	test.each([
		{ text: 'spelled', expected: { rules: ['/standards-packs/lightsout/rules/casing'], saysNoMatch: false } },
		{ text: 'nothing like this', expected: { rules: [], saysNoMatch: true } },
	])("narrows the pack's rules by the search text", ({ text, expected }) => {
		setupPackPage({ filters: { text } });

		const shownRules = readRuleLinks();
		const noMatch = screen.queryByText('No rule matches that.');

		expect({ rules: shownRules, saysNoMatch: noMatch !== null }).toStrictEqual(expected);
	});

	test('narrows the list to what the reader searched for, but keeps the pack’s own counts', () => {
		setupPackPage({ filters: { text: 'folder' } });

		const titles = readGroupTitles();
		const figures = readFigures();

		expect({ titles, rules: figures[0] }).toStrictEqual({ titles: ['Folder Structure'], rules: 'Rules: 2' });
	});

	test("links every rule row to the rule's page under its library", () => {
		setupPackPage();

		const folderSize = screen.getByRole('link', { name: /^folder-size/ });
		const casing = screen.getByRole('link', { name: /^casing/ });

		expect([folderSize.getAttribute('href'), casing.getAttribute('href')]).toStrictEqual([
			'/standards-packs/lightsout/rules/folder-size',
			'/standards-packs/lightsout/rules/casing',
		]);
	});

	test("lists the pack's topics in the side navigation by their titles", () => {
		setupPackPage({ pack: 'base' });

		const nav = screen.getByRole('navigation', { name: 'Rule groups' });
		const area = within(nav).queryByText('Architecture');
		const outsideTopic = within(nav).queryByText(/Casing Conventions/);
		const entries = within(nav)
			.getAllByRole('link')
			.map((link) => link.textContent);

		expect({ area: area !== null, outsideTopic: outsideTopic !== null, entries }).toEqual({
			area: true,
			outsideTopic: false,
			entries: [expect.stringMatching(/^Folder Structure\s*2$/)],
		});
	});

	test('files a topic of the tests set under unit testing in the side navigation', () => {
		setupPackPage({ pack: 'unit-testing' });

		const nav = screen.getByRole('navigation', { name: 'Rule groups' });
		const area = within(nav).queryByText('Unit testing');
		const entries = within(nav)
			.getAllByRole('link')
			.map((link) => link.textContent);

		expect({ area: area !== null, entries }).toEqual({ area: true, entries: [expect.stringMatching(/^Test Files\s*1$/)] });
	});

	test.each([
		{ typed: 'cas', filters: {}, expected: { text: 'cas' } },
		{ typed: '', filters: { text: 'cas' }, expected: { text: undefined } },
	])('hands the search text typed into the box to the filter change, cleared to no text', ({ typed, filters, expected }) => {
		const { onFiltersChange } = setupPackPage({ filters });

		const searchBox = screen.getByRole('searchbox', { name: 'Search rules' });
		fireEvent.change(searchBox, { target: { value: typed } });

		expect(onFiltersChange).toHaveBeenCalledWith(expected);
	});

	test('renders nothing for a pack the library does not hold', () => {
		setupPackPage({ pack: 'vue' });

		const heading = screen.queryByRole('heading', { level: 1 });

		expect(heading).toBeNull();
	});
});
