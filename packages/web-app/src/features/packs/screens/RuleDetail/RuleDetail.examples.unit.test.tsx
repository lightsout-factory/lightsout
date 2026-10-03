import { describe, expect, jest, test } from '@jest/globals';
import type { StandardsPackRuleView } from '@lightsout/engine';
import { FixtureSide, RuleExampleKind } from '@lightsout/engine/contracts';
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

const setupRuleDetail = ({ rule = buildStandardsPackRuleView() }: { rule?: StandardsPackRuleView } = {}) => {
	renderWithQueryClient({
		ui: <RuleDetail ruleId={rule.id} />,
		seed: [
			{ queryKey: [QueryKey.DefaultPackRule, rule.id], data: rule },
			{ queryKey: [QueryKey.DefaultPack], data: buildStandardsPackView({ rules: packRules }) },
		],
	});
};

/** The text of every code block captioned with this path, in page order. */
const readCode = ({ caption }: { caption: string }) => screen.getAllByText(caption).map((label) => label.closest('figure')?.querySelector('pre')?.textContent);

/** One section of the page, found by its heading. */
const getSection = ({ name }: { name: string }) => screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;

// Split from the page's own suite by concern: how the page shows a rule's
// examples, from a single file a side to a small repo opened on its focus file.
describe('RuleDetail examples', () => {
	test('shows the incorrect example before the correct one', () => {
		setupRuleDetail();

		const titles = within(getSection({ name: 'Examples' }))
			.getAllByRole('heading', { level: 3 })
			.map((heading) => heading.textContent);

		expect(titles).toStrictEqual(['Incorrect', 'Correct']);
	});

	test('shows each example verbatim under the file it would live in', () => {
		setupRuleDetail();

		const code = readCode({ caption: 'src/readLabel.ts' });

		expect(code).toStrictEqual(['return (value as string).toUpperCase();', "if (typeof value === 'string') {\treturn value.toUpperCase();}"]);
	});

	test('says a deterministic check flags the incorrect example and passes the correct one', () => {
		setupRuleDetail();

		const source = screen.getByText('The check flags the incorrect code and passes the correct code.');

		expect(source).toBeInTheDocument();
	});

	test('says the agent judges code like the examples, rather than exactly these files', () => {
		setupRuleDetail({ rule: buildStandardsPackRuleView({ overrides: { deterministic: false, agent: true } }) });

		const source = screen.getByText('The agent flags code like the incorrect example and accepts code like the correct one.');

		expect(source).toBeInTheDocument();
	});

	test('gives a side holding more than one file a tab per file, keyed by its path', () => {
		setupRuleDetail({
			rule: buildStandardsPackRuleView({
				fixtures: [
					{ side: FixtureSide.Fail, path: 'src/a.ts', text: 'const a = b as C;' },
					{ side: FixtureSide.Fail, path: 'src/b.ts', text: 'const b = c as D;' },
					{ side: FixtureSide.Pass, path: 'src/a.ts', text: 'const a = read();' },
				],
			}),
		});

		const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);

		expect(tabs).toStrictEqual(['src/a.ts', 'src/b.ts']);
	});

	test('leaves out a side with no example rather than drawing it empty', () => {
		setupRuleDetail({ rule: buildStandardsPackRuleView({ fixtures: [{ side: FixtureSide.Fail, path: 'src/a.ts', text: 'const a = b as C;' }] }) });

		const correct = screen.queryByRole('heading', { name: 'Correct' });

		expect(correct).not.toBeInTheDocument();
	});

	test('says the pack shipped without its examples when there are none', () => {
		setupRuleDetail({ rule: buildStandardsPackRuleView({ fixtures: [] }) });

		const notice = screen.getByText('This pack shipped without its examples.');

		expect(notice).toBeInTheDocument();
	});

	test('shows a repo example as a tree a side, opened on the file the rule declares', () => {
		setupRuleDetail({
			rule: buildStandardsPackRuleView({
				fixtures: [
					{ side: FixtureSide.Fail, path: 'package.json', text: '{}' },
					{ side: FixtureSide.Fail, path: 'src/unused.ts', text: 'export const unused = 1;' },
					{ side: FixtureSide.Pass, path: 'package.json', text: '{}' },
					{ side: FixtureSide.Pass, path: 'src/used.ts', text: 'export const used = 1;' },
				],
				example: { kind: RuleExampleKind.Repo, focus: { fail: 'src/unused.ts', pass: 'src/used.ts' } },
			}),
		});

		const selected = screen
			.getAllByRole('tab')
			.filter((tab) => tab.getAttribute('aria-selected') === 'true')
			.map((tab) => tab.textContent);

		expect({ trees: screen.getAllByRole('tablist').map((tree) => tree.getAttribute('aria-label')), selected }).toStrictEqual({
			trees: ['Incorrect files', 'Correct files'],
			selected: ['unused.ts', 'used.ts'],
		});
	});

	test('says a repo example is a small repo, so its extra files read as setting rather than as more examples', () => {
		setupRuleDetail({
			rule: buildStandardsPackRuleView({ example: { kind: RuleExampleKind.Repo, focus: { fail: 'src/readLabel.ts', pass: 'src/readLabel.ts' } } }),
		});

		const note = screen.getByText(/Each example is a small repo, because this rule looks across files/);

		expect(note).toBeInTheDocument();
	});
});
