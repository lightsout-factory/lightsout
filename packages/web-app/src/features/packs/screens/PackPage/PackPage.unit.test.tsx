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
		path: 'code/fractal/size',
		intro: '# Size Limits\n\nHow large things grow.',
		ruleIds: ['folder-size', 'folder-depth'],
	},
	{ set: StandardsSet.Code, path: 'code/fractal/modules', intro: '# Module Conventions', ruleIds: ['filename-mismatch'] },
	{ set: StandardsSet.Code, path: 'code/frameworks/react', intro: '# React Architecture', ruleIds: ['component-file-structure'] },
	{ set: StandardsSet.Tests, path: 'tests/test-files', intro: '# Test Files', ruleIds: ['test-file-location'] },
];

const rules = [
	buildStandardsPackRuleListing({ id: 'folder-size', documentPath: 'code/fractal/size', summary: 'a folder holding too many things' }),
	buildStandardsPackRuleListing({ id: 'folder-depth', documentPath: 'code/fractal/size', summary: 'a folder tree spelled out too deep' }),
	buildStandardsPackRuleListing({
		id: 'filename-mismatch',
		documentPath: 'code/fractal/modules',
		summary: 'a file name spelled differently from its export',
		deterministic: false,
		defaultSeverity: StandardsSeverity.Advisory,
	}),
	buildStandardsPackRuleListing({
		id: 'component-file-structure',
		documentPath: 'code/frameworks/react',
		summary: 'a component file laid out of order',
		deterministic: false,
	}),
	buildStandardsPackRuleListing({
		id: 'test-file-location',
		set: StandardsSet.Tests,
		documentPath: 'tests/test-files',
		summary: 'a test file kept away from its source',
	}),
];

/**
 * Pack `app` holds one rule from each of two topics, raises `filename-mismatch`
 * above its advisory default, and brings in the react topic with its one rule
 * removed — a topic left empty. Pack `base` holds only the size topic and is the
 * one conditional pack, and pack `tests` holds only the tests topic.
 */
const packs = [
	buildStandardsPackListing({
		name: 'app',
		description: 'The rules an app package runs.',
		include: { packs: ['lightsout/base', 'acme/house'], topics: ['lightsout/code/fractal/modules'], rules: [] },
		topics: ['lightsout/code/fractal/modules', 'lightsout/code/fractal/size', 'lightsout/code/frameworks/react'],
		rules: [
			{ name: 'lightsout/filename-mismatch', severity: StandardsSeverity.Blocking, options: {} },
			{ name: 'lightsout/folder-size', severity: StandardsSeverity.Blocking, options: {} },
		],
		totals: { deterministic: 1, agent: 1 },
	}),
	buildStandardsPackListing({
		name: 'base',
		appliesWhen: { dependencies: ['react', 'preact'] },
		include: { packs: [], topics: ['lightsout/code/fractal/size'], rules: [] },
		topics: ['lightsout/code/fractal/size'],
		rules: [
			{ name: 'lightsout/folder-depth', severity: StandardsSeverity.Blocking, options: {} },
			{ name: 'lightsout/folder-size', severity: StandardsSeverity.Blocking, options: {} },
		],
	}),
	buildStandardsPackListing({
		name: 'tests',
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

	test('says which packages a conditional pack reaches', () => {
		setupPackPage({ pack: 'base' });

		const condition = screen.getByText(/^Applies only/);

		expect(condition.textContent).toBe('Applies only to packages that depend on react or preact.');
	});

	test('says nothing about reach on a pack that applies to every package, even one including a conditional pack', () => {
		setupPackPage();

		const condition = screen.queryByText(/^Applies only/);

		expect(condition).toBeNull();
	});

	test('counts the pack’s own rules, and how many are deterministic checks and how many agent checks', () => {
		setupPackPage();

		const figures = readFigures();

		expect(figures).toStrictEqual(['Rules: 2', 'Deterministic checks: 1', 'Agent checks: 1']);
	});

	test('shows only the rules the pack holds, grouped under their topics', () => {
		setupPackPage();

		const titles = readGroupTitles();
		const size = readSectionRuleLinks({ title: /^Size Limits/ });
		const modules = readSectionRuleLinks({ title: /^Module Conventions/ });
		const everyRule = readRuleLinks();

		expect({ titles, size, modules, everyRule }).toStrictEqual({
			titles: ['Size Limits', 'Module Conventions'],
			size: ['/standards-packs/lightsout/rules/folder-size'],
			modules: ['/standards-packs/lightsout/rules/filename-mismatch'],
			everyRule: ['/standards-packs/lightsout/rules/folder-size', '/standards-packs/lightsout/rules/filename-mismatch'],
		});
	});

	test('says each rule’s kind of check', () => {
		setupPackPage();

		const row = screen.getByRole('link', { name: /^filename-mismatch/ });

		expect(within(row).queryByText('Agent')).not.toBeNull();
	});

	test('shows each rule at the severity the pack sets', () => {
		setupPackPage();

		const row = screen.getByRole('link', { name: /^filename-mismatch/ });

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
		{ text: 'spelled', expected: { rules: ['/standards-packs/lightsout/rules/filename-mismatch'], saysNoMatch: false } },
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

		expect({ titles, rules: figures[0] }).toStrictEqual({ titles: ['Size Limits'], rules: 'Rules: 2' });
	});

	test("links every rule row to the rule's page under its library", () => {
		setupPackPage();

		const folderSize = screen.getByRole('link', { name: /^folder-size/ });
		const filenameMismatch = screen.getByRole('link', { name: /^filename-mismatch/ });

		expect([folderSize.getAttribute('href'), filenameMismatch.getAttribute('href')]).toStrictEqual([
			'/standards-packs/lightsout/rules/folder-size',
			'/standards-packs/lightsout/rules/filename-mismatch',
		]);
	});

	test("lists the pack's topics in the side navigation by their titles", () => {
		setupPackPage({ pack: 'base' });

		const nav = screen.getByRole('navigation', { name: 'Rule groups' });
		const area = within(nav).queryByText('Fractal');
		const outsideTopic = within(nav).queryByText(/Module Conventions/);
		const entries = within(nav)
			.getAllByRole('link')
			.map((link) => link.textContent);

		expect({ area: area !== null, outsideTopic: outsideTopic !== null, entries }).toEqual({
			area: true,
			outsideTopic: false,
			entries: [expect.stringMatching(/^Size Limits\s*2$/)],
		});
	});

	test('files a topic of the tests set under unit testing in the side navigation', () => {
		setupPackPage({ pack: 'tests' });

		const nav = screen.getByRole('navigation', { name: 'Rule groups' });
		const area = within(nav).queryByText('Unit testing');
		const entries = within(nav)
			.getAllByRole('link')
			.map((link) => link.textContent);

		expect({ area: area !== null, entries }).toEqual({ area: true, entries: [expect.stringMatching(/^Test Files\s*1$/)] });
	});

	test.each([
		{ typed: 'file', filters: {}, expected: { text: 'file' } },
		{ typed: '', filters: { text: 'file' }, expected: { text: undefined } },
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
