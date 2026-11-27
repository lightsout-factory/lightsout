import { describe, expect, test } from '@jest/globals';
import { describeCleanupDetail } from '#src/cli/common/render/describeCleanupDetail.ts';
import type { CleanupSummary } from '#src/common/types/CleanupSummary.ts';
import { CleanupEndReason } from '#src/contracts/run/CleanupEndReason.ts';

const setupCleanup = (overrides: Partial<CleanupSummary> = {}) => {
	const cleanup: CleanupSummary = {
		rounds: 1,
		endReason: CleanupEndReason.Clean,
		remainingFindings: 0,
		carriedFindings: 0,
		reviewFindings: 0,
		failures: 0,
		targetedFindings: undefined,
		fixedFindings: undefined,
		fixedSites: [],
		remainingSites: [],
		...overrides,
	};

	return { cleanup };
};

describe('describeCleanupDetail', () => {
	test.each([
		{
			overrides: { targetedFindings: 0, fixedFindings: 0 },
			expected: ['no blocking findings handed to cleanup'],
		},
		{
			overrides: {
				targetedFindings: 3,
				fixedFindings: 2,
				remainingFindings: 1,
				fixedSites: [
					{ rule: 'acme/max-nesting', files: ['src/a.ts'] },
					{ rule: 'acme/no-default-export', files: ['src/b.ts'] },
				],
				remainingSites: [{ rule: 'acme/max-nesting', files: ['src/c.ts', 'src/d.ts'] }],
			},
			expected: ['found 3 · fixed 2', 'remaining acme/max-nesting — src/c.ts, src/d.ts'],
		},
		{
			overrides: {},
			expected: [],
		},
	])('describeCleanupDetail: found and fixed, one line per remaining site, nothing for an older record', ({ overrides, expected }) => {
		const { cleanup } = setupCleanup(overrides);

		const texts = describeCleanupDetail({ cleanup });

		expect(texts).toEqual(expected);
	});

	test('describeCleanupDetail: prints at most five remaining findings and counts the rest', () => {
		const { cleanup } = setupCleanup({
			remainingFindings: 7,
			remainingSites: [1, 2, 3, 4, 5, 6, 7].map((index) => ({ rule: 'acme/max-nesting', files: [`src/file${index}.ts`] })),
		});

		const texts = describeCleanupDetail({ cleanup });

		expect(texts).toEqual([
			'remaining acme/max-nesting — src/file1.ts',
			'remaining acme/max-nesting — src/file2.ts',
			'remaining acme/max-nesting — src/file3.ts',
			'remaining acme/max-nesting — src/file4.ts',
			'remaining acme/max-nesting — src/file5.ts',
			'+2 more remaining',
		]);
	});
});
