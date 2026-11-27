import { describe, expect, test } from '@jest/globals';
import { PlanFacts } from '@lightsout/engine/contracts';
import { render, screen, within } from '@testing-library/react';
import { FactsDetail } from '#src/features/workOrders/components/FactsDetail.tsx';

/** Parsed through the engine's own contract, so every default is filled as the reader fills it. */
const buildFacts = (overrides: Record<string, unknown> = {}) =>
	PlanFacts.parse({
		request: 'Rank results by recency.',
		verification: { pathsChecked: 3, scriptsChecked: 1 },
		verifiedAt: '2026-01-01T00:01:00.000Z',
		...overrides,
	});

const fullArea = {
	area: 'Ranking',
	affectedPackages: ['packages/search', 'packages/shared'],
	filesToModify: [{ path: 'src/ranking/rank.ts', role: 'orders the results' }],
	patternsToMirror: [{ path: 'src/ranking/sortByDate.ts', takeaway: 'one comparator per file' }],
	integrationPoints: [{ name: 'rank', signature: '({ results }) => Result[]', at: 'src/ranking/rank.ts:12' }],
	scripts: [{ key: 'test:unit', command: 'jest' }],
	namingConvention: 'One verb-first function per file.',
};

const setupFactsDetail = ({ facts }: { facts: PlanFacts | undefined }) => {
	render(<FactsDetail facts={facts} />);
};

/** Each table under `root` as its heading and its rows' text. */
const tablesOf = ({ root }: { root: HTMLElement }) =>
	within(root)
		.queryAllByRole('table')
		.map((table) => ({
			label: within(table).getByRole('columnheader').textContent,
			rows: within(table)
				.getAllByRole('row')
				.filter((row) => within(row).queryAllByRole('cell').length > 0)
				.map((row) =>
					within(row)
						.getAllByRole('cell')
						.map((cell) => cell.textContent),
				),
		}));

describe('FactsDetail', () => {
	test('says no facts are recorded before the facts are verified', () => {
		setupFactsDetail({ facts: undefined });

		expect(document.body.textContent).toBe('No facts recorded yet.');
	});

	test('shows the request, how the check came out, and each area with one table per kind of fact', () => {
		setupFactsDetail({ facts: buildFacts({ areas: [fullArea] }) });

		const section = screen.getByRole('heading', { name: 'Ranking' }).closest('section') as HTMLElement;

		expect({
			request: screen.queryAllByText('Rank results by recency.').length,
			checked: [screen.getByText(/paths checked/).textContent, screen.getByText(/scripts checked/).textContent],
			packages: within(section).queryAllByText('packages/search · packages/shared').length,
			convention: within(section).queryAllByText('One verb-first function per file.').length,
			tables: tablesOf({ root: section }),
			missing: screen.queryAllByText(/^Missing (paths|scripts)$/).length,
		}).toStrictEqual({
			request: 1,
			checked: ['3 paths checked · 0 missing', '1 scripts checked · 0 missing'],
			packages: 1,
			convention: 1,
			tables: [
				{ label: 'Files to modify', rows: [['src/ranking/rank.ts', 'orders the results']] },
				{ label: 'Patterns to mirror', rows: [['src/ranking/sortByDate.ts', 'one comparator per file']] },
				{ label: 'Integration points', rows: [['ranksrc/ranking/rank.ts:12', '({ results }) => Result[]']] },
				{ label: 'Scripts', rows: [['test:unit', 'jest']] },
			],
			missing: 0,
		});
	});

	test('draws no table and no package line for an area that recorded none', () => {
		setupFactsDetail({ facts: buildFacts({ areas: [{ area: 'Ranking', namingConvention: 'One verb-first function per file.' }] }) });

		const section = screen.getByRole('heading', { name: 'Ranking' }).closest('section') as HTMLElement;

		expect({ tables: tablesOf({ root: section }), lines: Array.from(section.querySelectorAll('p')).map((line) => line.textContent) }).toStrictEqual({
			tables: [],
			lines: ['One verb-first function per file.'],
		});
	});

	test('names every path and script the check could not find', () => {
		setupFactsDetail({
			facts: buildFacts({ verification: { pathsChecked: 3, missingPaths: ['src/gone.ts'], scriptsChecked: 2, missingScripts: ['lint', 'e2e'] } }),
		});

		const namesUnder = ({ label }: { label: string }) =>
			Array.from(screen.getByText(label).parentElement?.querySelectorAll('li') ?? []).map((name) => name.textContent);

		expect({
			checked: [screen.getByText(/paths checked/).textContent, screen.getByText(/scripts checked/).textContent],
			paths: namesUnder({ label: 'Missing paths' }),
			scripts: namesUnder({ label: 'Missing scripts' }),
		}).toStrictEqual({
			checked: ['3 paths checked · 1 missing', '2 scripts checked · 2 missing'],
			paths: ['src/gone.ts'],
			scripts: ['lint', 'e2e'],
		});
	});
});
