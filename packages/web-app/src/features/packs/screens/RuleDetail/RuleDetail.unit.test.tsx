import { describe, expect, jest, test } from '@jest/globals';
import type { StandardsPackListing, StandardsPackRuleView } from '@lightsout/engine';
import { StandardsSeverity } from '@lightsout/engine/contracts';
import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { RuleDetail } from '#src/features/packs/screens/RuleDetail/RuleDetail.tsx';
import { buildStandardsPackRuleListing } from '#tests/helpers/buildStandardsPackRuleListing.ts';
import { buildStandardsPackRuleView } from '#tests/helpers/buildStandardsPackRuleView.ts';
import { buildStandardsPackView } from '#tests/helpers/buildStandardsPackView.ts';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
// The trail above the page and the links to the rules either side need a live
// router to resolve a path. A plain anchor keeps the assertions about where
// the page points.
jest.mock('@tanstack/react-router', () => ({
	Link: ({
		to,
		params,
		hash,
		children,
		className,
		'aria-current': ariaCurrent,
	}: {
		to: string;
		params?: Record<string, string>;
		hash?: string;
		children: ReactNode;
		className?: string;
		'aria-current'?: 'page';
	}) => (
		<a
			href={`${Object.entries(params ?? {}).reduce((path, [name, value]) => path.replace(`$${name}`, value), to)}${hash === undefined ? '' : `#${hash}`}`}
			className={className}
			aria-current={ariaCurrent}
		>
			{children}
		</a>
	),
}));

// -------------------------

/** The set the page's rule sits in: the rule itself between two others, in one document. */
const packRules = [
	buildStandardsPackRuleListing({ id: 'no-any' }),
	buildStandardsPackRuleListing({ id: 'type-assertion' }),
	buildStandardsPackRuleListing({ id: 'explicit-return-type' }),
];

const setupRuleDetail = ({ rule = buildStandardsPackRuleView(), rules = packRules }: { rule?: StandardsPackRuleView; rules?: typeof packRules } = {}) => {
	renderWithQueryClient({
		ui: <RuleDetail ruleId={rule.id} />,
		seed: [
			{ queryKey: [QueryKey.DefaultPackRule, rule.id], data: rule },
			{ queryKey: [QueryKey.DefaultPack], data: buildStandardsPackView({ rules }) },
		],
	});

	return { rule };
};

/** One pack of the lightsout library, holding the rules named by their full names. */
const buildPack = ({ name, rules }: { name: string; rules: string[] }): StandardsPackListing => ({
	name,
	address: `lightsout/${name}`,
	include: { packs: [], topics: [], rules: [] },
	topics: ['lightsout/code/agent-corrections/type-safety'],
	rules: rules.map((rule) => ({ name: rule, severity: StandardsSeverity.Blocking, options: {} })),
	totals: { rules: rules.length, checked: rules.length, judgment: 0, topics: 1 },
});

/** The page's rule, `lightsout/type-assertion`, in a library whose packs are given. */
const setupRuleInPacks = ({ packs }: { packs: StandardsPackListing[] }) => {
	const rule = buildStandardsPackRuleView({ overrides: { name: 'lightsout/type-assertion' } });
	renderWithQueryClient({
		ui: <RuleDetail ruleId={rule.id} />,
		seed: [
			{ queryKey: [QueryKey.DefaultPackRule, rule.id], data: rule },
			{ queryKey: [QueryKey.DefaultPack], data: buildStandardsPackView({ rules: packRules, overrides: { name: 'lightsout', packs } }) },
		],
	});
};

/** Packs that hold the rule are listed and linked; a pack that does not is left out, and with none the page says so. */
const packHoldingCases: { packs: StandardsPackListing[]; expected: { packLinks: { name: string | null; href: string | null }[]; saysNoPack: boolean } }[] = [
	{
		packs: [
			buildPack({ name: 'nestjs', rules: ['lightsout/no-any'] }),
			buildPack({ name: 'standards', rules: ['lightsout/type-assertion'] }),
			buildPack({ name: 'react', rules: ['lightsout/no-any', 'lightsout/type-assertion'] }),
		],
		expected: {
			packLinks: [
				{ name: 'lightsout/standards', href: '/standards-packs/lightsout/packs/standards' },
				{ name: 'lightsout/react', href: '/standards-packs/lightsout/packs/react' },
			],
			saysNoPack: false,
		},
	},
	{
		packs: [buildPack({ name: 'nestjs', rules: ['lightsout/no-any'] }), buildPack({ name: 'standards', rules: ['lightsout/no-any'] })],
		expected: { packLinks: [], saysNoPack: true },
	},
];

/** A rule with default numbers, and one without: the first gets them under options, the second the bare severity. */
const configBlockCases: { defaultOptions: Record<string, number>; expected: unknown }[] = [
	{
		defaultOptions: { file: 250, tsxFile: 300 },
		expected: { 'standards-rule-settings': { 'file-size': { severity: 'blocking', options: { file: 250, tsxFile: 300 } } } },
	},
	{ defaultOptions: {}, expected: { 'standards-rule-settings': { 'file-size': 'blocking' } } },
];

/** The text of every code block captioned with this path, in page order. */
const readCode = ({ caption }: { caption: string }) => screen.getAllByText(caption).map((label) => label.closest('figure')?.querySelector('pre')?.textContent);

/** The config block the page offers, parsed, so the assertion pins the entries rather than the indentation. */
const readConfigSnippet = (): unknown => JSON.parse(readCode({ caption: 'lightsout.config.json' })[0] ?? '');

/** One section of the page, found by its heading. */
const getSection = ({ name }: { name: string }) => screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;

describe('RuleDetail', () => {
	test('shows the whole address a reader walked to get here, one step at a time', () => {
		setupRuleDetail();

		const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });

		expect(trail.textContent).toBe('Standards Packslightsouttype-assertion');
	});

	test('names the rule as the page, and says what it is about in its own words', () => {
		setupRuleDetail();

		expect(screen.getByRole('heading', { level: 1, name: 'type-assertion' })).toBeInTheDocument();
		expect(
			screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'When an as cast is fine, and when to narrow the type instead.'),
		).toBeInTheDocument();
	});

	test('says who enforces the rule and what it does by default, and nothing a reader cannot use', () => {
		setupRuleDetail();

		expect([screen.getByText('Deterministic check'), screen.getByText('Blocks by default')]).toHaveLength(2);
		expect([screen.queryByText('base'), screen.queryByText('code')]).toStrictEqual([null, null]);
	});

	test('calls an agent check an agent check, and says it only advises', () => {
		setupRuleDetail({ rule: buildStandardsPackRuleView({ overrides: { checked: false, defaultSeverity: StandardsSeverity.Advisory } }) });

		expect([screen.getByText('Agent check'), screen.getByText('Advises by default')]).toHaveLength(2);
	});

	test("prints the rule's own text, which is what a reader needs in order to disagree with it", () => {
		setupRuleDetail();

		const prose = within(getSection({ name: 'The rule' })).getByText(/Avoid/);

		expect(prose).toBeInTheDocument();
	});

	test('says agents read that text as written, so a reader knows nothing else is behind it', () => {
		setupRuleDetail();

		const note = within(getSection({ name: 'The rule' })).getByText('Agents read this text as written when they write and review code.');

		expect(note).toBeInTheDocument();
	});

	test('drops an opening heading that only repeats the rule name', () => {
		setupRuleDetail({ rule: buildStandardsPackRuleView({ prose: '## Type Assertion\n\nAvoid `as` casts.' }) });

		const heading = screen.queryByRole('heading', { name: 'Type Assertion' });

		expect(heading).not.toBeInTheDocument();
	});

	test('says as much for a rule that argues only through its examples, rather than leaving a blank section', () => {
		setupRuleDetail({ rule: buildStandardsPackRuleView({ prose: '' }) });

		const line = screen.getByText('This rule states its summary and shows it with examples.');

		expect(line).toBeInTheDocument();
	});

	test('lists the three settings a rule can take, and marks the one the pack ships', () => {
		setupRuleDetail();

		const settings = within(getSection({ name: 'Configure' }))
			.getAllByRole('listitem')
			.map((item) => item.textContent);

		expect(settings).toStrictEqual([
			'Block"blocking"Stops a run when a file the run changed breaks the rule.Default',
			'Advise"advisory"Reports it and hands it to the refactor agent. Never stops a run.',
			'Off"off"Not checked. Use it when your own linter already enforces the rule.',
		]);
	});

	test('offers the config block at the pack default, so pasting it changes nothing until a value is edited', () => {
		setupRuleDetail();

		const snippet = readConfigSnippet();

		expect(snippet).toStrictEqual({ 'standards-rule-settings': { 'type-assertion': 'blocking' } });
	});

	test('puts a rule’s numbers in that block, ready to change', () => {
		setupRuleDetail({
			rule: buildStandardsPackRuleView({ id: 'file-size', overrides: { defaultOptions: { maxLines: 250 } } }),
			rules: [buildStandardsPackRuleListing({ id: 'file-size' })],
		});

		const snippet = readConfigSnippet();

		expect(snippet).toStrictEqual({ 'standards-rule-settings': { 'file-size': { severity: 'blocking', options: { maxLines: 250 } } } });
	});

	test.each(configBlockCases)("the config block puts a rule's default numbers under options", ({ defaultOptions, expected }) => {
		setupRuleDetail({
			rule: buildStandardsPackRuleView({ id: 'file-size', overrides: { defaultOptions } }),
			rules: [buildStandardsPackRuleListing({ id: 'file-size' })],
		});

		const snippet = readConfigSnippet();

		expect(snippet).toStrictEqual(expected);
	});

	test('offers that block for copying, since it is meant to be pasted rather than retyped', () => {
		setupRuleDetail();

		const button = screen.getByRole('button', { name: 'Copy' });

		expect(button).toBeInTheDocument();
	});

	test('links to the rules either side, so a reader can walk the set', () => {
		setupRuleDetail();

		const links = within(screen.getByRole('navigation', { name: 'Neighbouring rules' }))
			.getAllByRole('link')
			.map((link) => link.getAttribute('href'));

		expect(links).toStrictEqual(['/standards-packs/lightsout/rules/no-any', '/standards-packs/lightsout/rules/explicit-return-type']);
	});

	test('shows no neighbour links for a rule alone in its set', () => {
		setupRuleDetail({ rules: [buildStandardsPackRuleListing()] });

		const neighbours = screen.queryByRole('navigation', { name: 'Neighbouring rules' });

		expect(neighbours).not.toBeInTheDocument();
	});

	test('shows nothing of any repo, since it is a public page', () => {
		setupRuleDetail();

		expect([screen.queryByRole('heading', { name: 'In this repo' }), screen.queryByRole('link', { name: /findings/ })]).toStrictEqual([null, null]);
	});

	test('trails from the packs page through the library to the rule', () => {
		setupRuleDetail();

		const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });

		expect({
			text: trail.textContent,
			links: within(trail)
				.getAllByRole('link')
				.map((link) => link.getAttribute('href')),
		}).toStrictEqual({ text: 'Standards Packslightsouttype-assertion', links: ['/standards-packs'] });
	});

	test.each(packHoldingCases)('lists the packs that hold the rule, each linking to its page', ({ packs, expected }) => {
		setupRuleInPacks({ packs });

		const packLinks = screen
			.queryAllByRole('link')
			.filter((link) => /^\/standards-packs\/[^/]+\/packs\//.test(link.getAttribute('href') ?? ''))
			.map((link) => ({ name: link.textContent, href: link.getAttribute('href') }));
		const saysNoPack = screen.queryAllByText(/no pack/i).length > 0;

		expect({ packLinks, saysNoPack }).toStrictEqual(expected);
	});

	test('links the neighbouring rules to their pages under the library', () => {
		setupRuleDetail();

		const links = within(screen.getByRole('navigation', { name: 'Neighbouring rules' }))
			.getAllByRole('link')
			.map((link) => link.getAttribute('href'));

		expect(links).toStrictEqual(['/standards-packs/lightsout/rules/no-any', '/standards-packs/lightsout/rules/explicit-return-type']);
	});
});
