import { describe, expect, jest, test } from '@jest/globals';
import type { Driver } from '#src/common/types/Driver.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { runBatchReview } from '#src/refactor/batch/runBatch/common/runBatchReview.ts';
import { createUncalledDriver } from '#tests/helpers/createUncalledDriver.ts';

// Mocked Imports
// -------------------------
// The review runner spawns a harness and has its own tests; what the batch
// review owns is what it hands over, observable with the runner stubbed.

interface RunStandardsReviewParams {
	cwd: string;
	driver: Driver;
	groups: StandardsGroup[];
	packagesDir: string;
	files: string[];
	timeoutMs?: number;
	onProgress?: (message: string) => void;
}

const mockRunStandardsReview = jest.fn<(params: RunStandardsReviewParams) => Promise<{ findings: StandardsFinding[]; notes: string[] }>>();

jest.mock('#src/standardsCheck/runStandardsReview/runStandardsReview.ts', () => ({
	runStandardsReview: (params: RunStandardsReviewParams) => mockRunStandardsReview(params),
}));
// -------------------------
interface AppendReviewFindingsParams {
	cwd: string;
	runId: string;
	step: string;
	findings: StandardsFinding[];
}

const mockAppendReviewFindings = jest.fn<(params: AppendReviewFindingsParams) => Promise<void>>();

jest.mock('#src/runState/appendReviewFindings.ts', () => ({
	appendReviewFindings: (params: AppendReviewFindingsParams) => mockAppendReviewFindings(params),
}));
// -------------------------

const setupBatchReview = ({ packagesDir }: { packagesDir: string }) => {
	mockRunStandardsReview.mockResolvedValue({ findings: [], notes: [] });
	mockAppendReviewFindings.mockResolvedValue(undefined);

	const batch: RefactorBatch = { id: 'batch-01:multi-export:apps/web', rule: 'lightsout/multi-export', folder: 'apps/web', blocking: [], advisories: [] };
	const group: StandardsGroup = {
		packages: ['', 'web'],
		pack: { name: 'lightsout/standards', topics: [], rules: [], conditionalPacks: [], inactiveRules: [] },
		states: new Map(),
	};

	return {
		params: {
			cwd: '/repo',
			runId: 'run-1',
			driver: createUncalledDriver({ reason: 'the review runner is stubbed, so no agent is spawned' }),
			batch,
			groups: [group],
			packagesDir,
			files: ['apps/web/src/index.ts'],
			agentReview: true,
			timeoutMs: 60_000,
			onProgress: () => undefined,
		},
	};
};

describe('runBatchReview', () => {
	test('forwards packagesDir to the standards review', async () => {
		const { params } = setupBatchReview({ packagesDir: 'apps' });

		await runBatchReview(params);

		expect(mockRunStandardsReview).toHaveBeenCalledWith(expect.objectContaining({ packagesDir: 'apps' }));
	});
});
