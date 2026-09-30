import { describe, expect, jest, test } from '@jest/globals';
import type { ConfigView } from '@lightsout/engine';
import { StandardsSeverity } from '@lightsout/engine/contracts';
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

describe('ConfigPage rule ledger', () => {
	const ruleStates: ConfigView['ruleStates'] = [
		{
			rule: 'file-size',
			id: 'file-size',
			library: 'lightsout',
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
			severity: StandardsSeverity.Off,
			fromConfig: true,
			options: {},
			packages: [''],
			appliesTo: 'repo root (outside packages)',
		},
	];

	test('lists every loaded rule, whichever pack declared it', () => {
		setupConfigPage({ overrides: { ruleStates } });

		const rules = screen.getAllByText(/^(file-size|loose-file|naming-boolean)$/).map((cell) => cell.textContent);

		expect(rules).toStrictEqual(['file-size', 'loose-file', 'naming-boolean']);
	});

	test('points a rule at its page under the library it belongs to', () => {
		setupConfigPage({ overrides: { ruleStates } });

		const link = screen.getByRole('link', { name: 'loose-file' });

		expect(link).toHaveAttribute('href', '/standards-packs/lightsout/rules/loose-file');
	});

	test('the rule ledger shows the full name and links by the rule id', () => {
		setupConfigPage({
			overrides: {
				ruleStates: [
					{
						rule: 'lightsout/file-size',
						id: 'file-size',
						library: 'lightsout',
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

		expect(link).toHaveAttribute('href', '/standards-packs/lightsout/rules/file-size');
	});

	test('links each ledger rule to its page under its library', () => {
		setupConfigPage({
			overrides: {
				ruleStates: [
					{
						rule: 'lightsout/function-size',
						id: 'function-size',
						library: 'lightsout',
						severity: StandardsSeverity.Blocking,
						fromConfig: false,
						options: {},
						packages: [''],
						appliesTo: 'repo root (outside packages)',
					},
					{
						rule: 'acme/house-rule',
						id: 'house-rule',
						library: 'acme',
						severity: StandardsSeverity.Advisory,
						fromConfig: false,
						options: {},
						packages: [''],
						appliesTo: 'repo root (outside packages)',
					},
				],
			},
		});

		const builtInLink = screen.getByRole('link', { name: 'lightsout/function-size' });
		const foreignName = screen.getByText('acme/house-rule');

		expect({ href: builtInLink.getAttribute('href'), foreignIsLinked: foreignName.closest('a') !== null }).toStrictEqual({
			href: '/standards-packs/lightsout/rules/function-size',
			foreignIsLinked: false,
		});
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
