import { describe, expect, test } from '@jest/globals';
import { DedupReport } from '@lightsout/engine/contracts';
import { render, screen, within } from '@testing-library/react';
import { DedupDetail } from '#src/features/workOrders/components/DedupDetail.tsx';

/** Parsed through the engine's own contract, so every default is filled as the reader fills it. */
const buildDedup = (overrides: Record<string, unknown> = {}) =>
	DedupReport.parse({ planName: 'lo-7-search-ranking/001-ranking', reviewed: [], reviewedAt: '2026-01-01T00:03:00.000Z', ...overrides });

const reviewed = { plannedSymbol: 'sortByAge', plannedPath: 'src/ranking/sortByAge.ts', phase: 'plan.md' };

const finding = { ...reviewed, recommendation: 'reuse', rationale: 'sortByDate already orders by age.' };

const setupDedupDetail = ({ dedup }: { dedup: DedupReport | undefined }) => {
	render(<DedupDetail dedup={dedup} />);
};

const noteCases = [
	{ dedup: undefined, expected: ['Not checked for duplicates yet.'] },
	{ dedup: buildDedup(), expected: ['No duplicates found', '0 collisions reviewed'] },
	{ dedup: buildDedup({ reviewed: [reviewed] }), expected: ['No duplicates found', '1 collision reviewed'] },
	{ dedup: buildDedup({ complete: false, incompleteReason: 'a judge failed' }), expected: ['Incomplete — a judge failed', '0 collisions reviewed'] },
	{ dedup: buildDedup({ complete: false }), expected: ['Incomplete', '0 collisions reviewed'] },
];

const findingCases = [
	{
		finding: { ...finding, collidesWith: [{ name: 'sortByDate', path: 'src/ranking/sortByDate.ts' }], suggestedLocation: 'src/ranking/common/sortByAge.ts' },
		expected: {
			lines: [
				expect.stringMatching(/sortByAge.*reuse.*src\/ranking\/sortByAge\.ts.*plan\.md/),
				'sortByDate already orders by age.',
				'src/ranking/common/sortByAge.ts',
			],
			collisions: ['sortByDate · src/ranking/sortByDate.ts'],
		},
	},
	{
		finding,
		expected: { lines: [expect.stringMatching(/sortByAge.*reuse/), 'sortByDate already orders by age.'], collisions: [] },
	},
];

describe('DedupDetail', () => {
	test.each(noteCases)('says how the duplicate check came out when it found nothing', ({ dedup, expected }) => {
		setupDedupDetail({ dedup });

		expect(Array.from(document.body.querySelectorAll('p')).map((line) => line.textContent)).toStrictEqual(expected);
	});

	test.each(findingCases)('lists each duplicate with what it collides with and what to do about it', ({ finding: found, expected }) => {
		setupDedupDetail({ dedup: buildDedup({ findings: [found], reviewed: [reviewed] }) });

		const [item] = within(screen.getByRole('list', { name: 'Duplicates' })).getAllByRole('listitem');

		expect({
			lines: Array.from(item?.querySelectorAll(':scope > p') ?? []).map((line) => line.textContent),
			collisions: Array.from(item?.querySelectorAll('li') ?? []).map((collision) => collision.textContent),
			cleanNote: screen.queryAllByText('No duplicates found').length,
		}).toStrictEqual({ ...expected, cleanNote: 0 });
	});
});
