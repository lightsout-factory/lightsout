import { describe, expect, jest, test } from '@jest/globals';
import type { ConfigView } from '@lightsout/engine';
import { StandardsPackSource, StandardsSeverity } from '@lightsout/engine/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { ConfigPage } from '#src/features/config/screens/ConfigPage/ConfigPage.tsx';
import { buildConfigView } from '#tests/helpers/buildConfigView.ts';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
// Every pack and every rule on this page is a link into the pack pages, and a
// link needs a live router to resolve a path. A plain anchor keeps the
// assertions about where a row points rather than about the routing library.
jest.mock('@tanstack/react-router', () => ({
	Link: ({ to, params, children, className }: { to: string; params?: Record<string, string>; children: ReactNode; className?: string }) => (
		<a href={Object.entries(params ?? {}).reduce((path, [name, value]) => path.replace(`$${name}`, value), to)} className={className}>
			{children}
		</a>
	),
}));
// -------------------------

const setupConfigPage = ({ overrides = {} }: { overrides?: Partial<ConfigView> } = {}) => {
	const view = buildConfigView({ overrides });

	renderWithQueryClient({ ui: <ConfigPage />, seed: [{ queryKey: [QueryKey.Config], data: view }] });

	return { view };
};

/**
 * The page reduced to one config key.
 *
 * The standards card marks how its pack was chosen with a badge of its own, so
 * a row's provenance badge can only be read unambiguously on a page carrying no
 * pack group.
 */
const setupFieldRow = ({ field }: { field: ConfigView['sections'][number]['fields'][number] }) =>
	setupConfigPage({ overrides: { sections: [{ title: 'Gates', fields: [field] }], standardsGroups: [], ruleStates: [] } });

/** The severity facet over the ledger, opened and then narrowed the way a reader narrows it. */
const chooseSeverity = ({ name }: { name: RegExp }) => {
	fireEvent.click(screen.getByRole('button', { name: /severity/ }));
	fireEvent.click(screen.getByRole('checkbox', { name }));
};

describe('ConfigPage', () => {
	test('names the page and puts the file it read under that name, so a reader knows which config this is', () => {
		setupConfigPage({ overrides: { path: '/repos/other-project/lightsout.config.json' } });

		const heading = screen.getByRole('heading', { level: 1, name: 'Config' });

		expect(heading).toBeInTheDocument();
		expect(screen.getByText('/repos/other-project/lightsout.config.json')).toBeInTheDocument();
	});

	test('draws one card per section the view grouped, in the order it grouped them', () => {
		setupConfigPage({
			overrides: {
				sections: [
					{ title: 'Harness', fields: [{ key: 'harness', value: 'claude-code', fromConfig: true, description: 'Which agent harness runs the work.' }] },
					{ title: 'Gates', fields: [{ key: 'gates', value: { check: 'pnpm check' }, fromConfig: true, description: 'Verification commands.' }] },
				],
			},
		});

		const titles = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);

		expect(titles).toStrictEqual(['Harness', 'Gates', 'Standards pack in use', 'Rules']);
	});

	test('sends a reader on to the doc that explains every key, since this page only shows what the file holds', () => {
		setupConfigPage();

		const link = screen.getByRole('link', { name: 'What every key means →' });

		expect(link).toHaveAttribute('href', '/docs/configuration');
	});
});

describe('ConfigPage field rows', () => {
	test('names the key exactly as the file spells it, so a reader can find it in their own config', () => {
		setupFieldRow({
			field: { key: 'coverage-summary-path', value: 'coverage/coverage-summary.json', fromConfig: false, description: 'Where the report lands.' },
		});

		const key = screen.getByText('coverage-summary-path');

		expect(key).toBeInTheDocument();
	});

	test('marks a value this repo chose, which is the half a reader cannot get by opening the file', () => {
		setupFieldRow({ field: { key: 'gates', value: { check: 'pnpm check' }, fromConfig: true, description: 'Verification commands.' } });

		expect(screen.getByText('from config')).toBeInTheDocument();
		expect(screen.queryByText('default')).not.toBeInTheDocument();
	});

	test('marks a value lightsout filled in, so nobody goes looking for it in their own file', () => {
		setupFieldRow({ field: { key: 'packages-dir', value: 'packages', fromConfig: false, description: 'Where packages live.' } });

		expect(screen.getByText('default')).toBeInTheDocument();
		expect(screen.queryByText('from config')).not.toBeInTheDocument();
	});

	test('prints a plain value as the JSON a reader would have typed into the file', () => {
		setupFieldRow({ field: { key: 'packages-dir', value: 'packages', fromConfig: false, description: 'Where packages live.' } });

		const value = screen.getByText('"packages"');

		expect(value).toBeInTheDocument();
	});

	test('pretty-prints a block value, because a one-line object is what nobody can read', () => {
		setupFieldRow({ field: { key: 'gates', value: { check: 'pnpm check', test: 'pnpm test' }, fromConfig: true, description: 'Verification commands.' } });

		const block = screen.getByText(/"check"/);

		expect(JSON.parse(block.textContent ?? '')).toStrictEqual({ check: 'pnpm check', test: 'pnpm test' });
	});

	test('says in words that a key has no default, rather than printing a null somebody would read as a setting', () => {
		setupFieldRow({ field: { key: 'vendored', value: null, fromConfig: false, description: 'Paths nobody here wrote.' } });

		expect(screen.getByText('default: none')).toBeInTheDocument();
		expect(screen.queryByText('null')).not.toBeInTheDocument();
	});

	test("carries the schema's own sentence about the key, so the page and the contract cannot disagree", () => {
		setupFieldRow({ field: { key: 'standards-rule-settings', value: null, fromConfig: false, description: 'Per-rule severity and options.' } });

		const description = screen.getByText('Per-rule severity and options.');

		expect(description).toBeInTheDocument();
	});
});

describe('ConfigPage packs card', () => {
	test('points the pack in use at the Standards Packs page, which is where what it says lives', () => {
		setupConfigPage({
			overrides: { standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'acme/house', source: StandardsPackSource.Named }] },
		});

		const link = screen.getByRole('link', { name: 'acme/house' });

		expect(link).toHaveAttribute('href', '/standards-packs');
	});

	test('marks the pack lightsout detected when the config names none', () => {
		setupConfigPage({
			overrides: {
				standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'lightsout/node', source: StandardsPackSource.Detected }],
			},
		});

		const card = screen.getByRole('heading', { level: 3, name: 'Standards pack in use' }).closest('section');

		expect(within(card as HTMLElement).getByText('detected')).toBeInTheDocument();
	});

	test('speaks a named pack and a detected one in different tones, so a reader tells a choice from a guess at a glance', () => {
		setupConfigPage({
			overrides: {
				standardsGroups: [
					{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'acme/house', source: StandardsPackSource.Named },
					{ packages: ['api'], appliesTo: 'api', pack: 'lightsout/node', source: StandardsPackSource.Detected },
				],
				ruleStates: [],
			},
		});

		const tones = [screen.getByText('named'), screen.getByText('detected')].map((badge) => badge.className);

		expect(tones[0]).toContain('bg-[image:var(--brand-gradient)]');
		expect(tones[1]).toContain('text-muted-foreground-strong');
	});

	test('says plainly that no standards load here, rather than showing an empty card', () => {
		setupConfigPage({ overrides: { standardsGroups: [] } });

		const notice = screen.getByText(/No standards load here/);

		expect(notice).toBeInTheDocument();
	});
});

describe('ConfigPage standards card', () => {
	test.each([
		{
			standardsGroups: [
				{ packages: ['', 'api'], appliesTo: 'repo root (outside packages), api', pack: 'lightsout/node', source: StandardsPackSource.Detected },
			],
			expected: { href: '/standards-packs', badge: 'detected', coversRepoRoot: true, coversApi: true, announcesNone: false },
		},
		{
			standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'lightsout/node', source: StandardsPackSource.Named }],
			expected: { href: '/standards-packs', badge: 'named', coversRepoRoot: true, coversApi: false, announcesNone: false },
		},
		{
			standardsGroups: [],
			expected: { href: null, badge: null, coversRepoRoot: false, coversApi: false, announcesNone: true },
		},
	])('ConfigPage: the standards card shows the pack in use, how it was chosen and what it covers', ({ standardsGroups, expected }) => {
		setupConfigPage({ overrides: { standardsGroups, ruleStates: [] } });

		const link = screen.queryByRole('link', { name: 'lightsout/node' });
		const badge = screen.queryByText(/^(named|detected)$/);
		const pageText = document.body.textContent ?? '';

		expect({
			href: link?.getAttribute('href') ?? null,
			badge: badge?.textContent ?? null,
			coversRepoRoot: /repo root/i.test(pageText),
			coversApi: /\bapi\b/.test(pageText),
			announcesNone: /standards-pack\b[^.]*false/.test(pageText),
		}).toStrictEqual(expected);
	});

	test.each([
		{
			standardsGroups: [
				{ packages: ['', 'engine'], appliesTo: 'repo root (outside packages), engine', pack: 'lightsout/node', source: StandardsPackSource.Named },
				{ packages: ['web-app'], appliesTo: 'web-app', pack: 'lightsout/tanstack-start-app', source: StandardsPackSource.Detected },
			],
			expected: {
				rows: [
					{ pack: 'lightsout/node', badge: 'named', namesItsPackages: true, namesRepoRoot: true },
					{ pack: 'lightsout/tanstack-start-app', badge: 'detected', namesItsPackages: true, namesRepoRoot: false },
				],
				showsEmptyState: false,
			},
		},
		{
			standardsGroups: [],
			expected: { rows: [], showsEmptyState: true },
		},
	])('draws one row per standards group, naming its pack, whether it was named or detected, and the packages it covers', ({ standardsGroups, expected }) => {
		setupConfigPage({ overrides: { standardsGroups, ruleStates: [] } });

		const card = screen.getByRole('heading', { level: 3, name: 'Standards pack in use' }).closest('section') as HTMLElement;
		const rows = within(card)
			.queryAllByRole('link')
			.map((link, index) => {
				const row = link.parentElement as HTMLElement;
				const rowText = row.textContent ?? '';

				return {
					pack: link.textContent,
					badge: within(row).getByText(/^(named|detected)$/).textContent,
					namesItsPackages: rowText.includes(standardsGroups[index].appliesTo),
					namesRepoRoot: /repo root/.test(rowText),
				};
			});
		const showsEmptyState = /no standards/i.test(card.textContent ?? '');

		expect({ rows, showsEmptyState }).toStrictEqual(expected);
	});
});

describe('ConfigPage rule ledger', () => {
	const ruleStates: ConfigView['ruleStates'] = [
		{
			rule: 'file-size',
			id: 'file-size',
			library: 'lightsout',
			channel: 'base',
			severity: StandardsSeverity.Blocking,
			fromConfig: true,
			options: { file: 250 },
			packages: [''],
			appliesTo: 'repo root (outside packages)',
		},
		{
			rule: 'loose-file',
			id: 'loose-file',
			library: 'lightsout',
			channel: 'base',
			severity: StandardsSeverity.Advisory,
			fromConfig: false,
			options: {},
			packages: [''],
			appliesTo: 'repo root (outside packages)',
		},
		{
			rule: 'naming-boolean',
			id: 'naming-boolean',
			library: 'acme-house-rules',
			channel: 'base',
			severity: StandardsSeverity.Off,
			fromConfig: true,
			options: {},
			packages: [''],
			appliesTo: 'repo root (outside packages)',
		},
	];

	test('lists every loaded rule, whichever pack declared it', () => {
		setupConfigPage({ overrides: { ruleStates } });

		const rules = screen.getAllByRole('link', { name: /^(file-size|loose-file|naming-boolean)$/ }).map((link) => link.textContent);

		expect(rules).toStrictEqual(['file-size', 'loose-file', 'naming-boolean']);
	});

	test('points a rule at its page in the set it belongs to', () => {
		setupConfigPage({ overrides: { ruleStates } });

		const link = screen.getByRole('link', { name: 'naming-boolean' });

		expect(link).toHaveAttribute('href', '/standards-packs/typescript/naming-boolean');
	});

	test('the rule ledger shows the full name and links by the rule id', () => {
		setupConfigPage({
			overrides: {
				ruleStates: [
					{
						rule: 'lightsout/file-size',
						id: 'file-size',
						library: 'lightsout',
						channel: 'base',
						severity: StandardsSeverity.Blocking,
						fromConfig: true,
						options: { file: 250 },
						packages: [''],
						appliesTo: 'repo root (outside packages)',
					},
				],
			},
		});

		const link = screen.getByRole('link', { name: 'lightsout/file-size' });

		expect(link).toHaveAttribute('href', '/standards-packs/typescript/file-size');
	});

	test('says of each rule whether this repo set its state or the pack did', () => {
		setupConfigPage({ overrides: { ruleStates } });

		const setters = screen.getAllByText(/^(this repo|the pack)$/).map((cell) => cell.textContent);

		expect(setters).toStrictEqual(['this repo', 'the pack', 'this repo']);
	});

	test('speaks the three states in three different colours, since a rule turned off is not a rule being broken', () => {
		setupConfigPage({ overrides: { ruleStates } });

		const families = [screen.getByText('blocking'), screen.getByText('advisory'), screen.getByText('off')].map((badge) => badge.className);

		expect(families[0]).toContain('text-severity-blocking');
		expect(families[1]).toContain('text-severity-advisory');
		expect(families[2]).toContain('text-muted-foreground-strong');
	});

	test('shows the numbers this repo tuned a rule to', () => {
		setupConfigPage({ overrides: { ruleStates } });

		const option = screen.getByText(/^file\s+250$/);

		expect(option).toBeInTheDocument();
	});

	test('leaves a dash where a repo tuned nothing, rather than an empty cell', () => {
		setupConfigPage({ overrides: { ruleStates: [ruleStates[1]] } });

		const cells = screen.getAllByText('—');

		expect(cells).toHaveLength(1);
	});

	test("shows each rule's options in the ledger's options column, and a dash when it has none", () => {
		setupConfigPage({
			overrides: {
				ruleStates: [
					{
						rule: 'file-size',
						id: 'file-size',
						library: 'lightsout',
						channel: 'base',
						severity: StandardsSeverity.Blocking,
						fromConfig: true,
						options: { file: 250, tsxFile: 300 },
						packages: [''],
						appliesTo: 'repo root (outside packages)',
					},
					{
						rule: 'loose-file',
						id: 'loose-file',
						library: 'lightsout',
						channel: 'base',
						severity: StandardsSeverity.Advisory,
						fromConfig: false,
						options: {},
						packages: [''],
						appliesTo: 'repo root (outside packages)',
					},
				],
			},
		});

		const header = screen.getByRole('columnheader', { name: 'options' });
		const column = screen.getAllByRole('columnheader').indexOf(header);
		const cells = screen
			.getAllByRole('row')
			.slice(1)
			.map((row) => within(row).getAllByRole('cell')[column]);
		const pairs = within(cells[0])
			.getAllByText(/^\w+\s+\d+$/)
			.map((tag) => tag.textContent);

		expect({ pairs, untuned: cells[1].textContent }).toStrictEqual({ pairs: ['file 250', 'tsxFile 300'], untuned: '—' });
	});

	test('narrows the ledger to the state a reader picked', () => {
		setupConfigPage({ overrides: { ruleStates } });

		chooseSeverity({ name: /advisory/ });

		expect(screen.getByRole('link', { name: 'loose-file' })).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'file-size' })).not.toBeInTheDocument();
	});

	test('offers each state with how many rules run at it, so a reader sees the shape before picking', () => {
		setupConfigPage({ overrides: { ruleStates } });

		fireEvent.click(screen.getByRole('button', { name: /severity/ }));

		expect(screen.getByRole('checkbox', { name: /blocking/ })).toHaveTextContent('1');
		expect(screen.getByRole('checkbox', { name: /^off/ })).toHaveTextContent('1');
	});

	test('says so when a chosen state has no rules at it, rather than showing a headed empty table', () => {
		setupConfigPage({ overrides: { ruleStates: [ruleStates[0]] } });

		chooseSeverity({ name: /^off/ });

		const notice = screen.getByText('No rules match this severity.');

		expect(notice).toBeInTheDocument();
	});
});
