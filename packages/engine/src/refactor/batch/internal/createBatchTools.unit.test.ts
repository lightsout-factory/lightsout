import { describe, expect, jest, test } from '@jest/globals';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { createBatchTools } from '#src/refactor/batch/internal/createBatchTools.ts';
import { createUncalledDriver } from '#tests/helpers/createUncalledDriver.ts';

// Mocked Imports
// -------------------------
// The batch output review spawns a harness and has its own tests; what the
// tools own is what they hand it, observable with the review stubbed.

interface ReviewBatchOutputParams {
	cwd: string;
	runId: string;
	driver: Driver;
	batch: RefactorBatch;
	groups: StandardsGroup[];
	packagesDir: string;
	baseline: StandardsFinding[];
	changedFiles: string[];
	agentReview: boolean;
	timeoutMs: number;
	onProgress: (message: string) => void;
}

const mockReviewBatchOutput = jest.fn<(params: ReviewBatchOutputParams) => Promise<StandardsFinding[]>>();

jest.mock('#src/refactor/batch/reviewBatchOutput.ts', () => ({
	reviewBatchOutput: (params: ReviewBatchOutputParams) => mockReviewBatchOutput(params),
}));
// -------------------------
// The changed-file list reads git; the tools only pass it through.

interface CollectBatchChangesParams {
	cwd: string;
	config: LightsoutConfig;
	reportedFiles: Set<string>;
	attributedFiles: string[];
}

const mockCollectBatchChanges = jest.fn<(params: CollectBatchChangesParams) => Promise<string[]>>();

jest.mock('#src/common/utils/collectBatchChanges.ts', () => ({
	collectBatchChanges: (params: CollectBatchChangesParams) => mockCollectBatchChanges(params),
}));
// -------------------------
// The standards check walks the tree and has its own tests; what the tools own
// is the config they hand the per-batch re-check.

interface RunStandardsCheckParams {
	cwd: string;
	config: LightsoutConfig | undefined;
	path?: string;
	all?: boolean;
	writeBaseline?: boolean;
	persist?: boolean;
	onProgress?: (message: string) => void;
}

const mockRunStandardsCheck = jest.fn<(params: RunStandardsCheckParams) => Promise<{ findings: StandardsFinding[]; notes: string[] }>>();

jest.mock('#src/standardsCheck/runStandardsCheck.ts', () => ({
	runStandardsCheck: (params: RunStandardsCheckParams) => mockRunStandardsCheck(params),
}));
// -------------------------

const setupBatchTools = ({ packagesDir }: { packagesDir: string }) => {
	mockReviewBatchOutput.mockResolvedValue([]);
	mockCollectBatchChanges.mockResolvedValue(['apps/web/src/index.ts']);
	mockRunStandardsCheck.mockResolvedValue({ findings: [], notes: [] });

	const batch: RefactorBatch = { id: 'batch-01:multi-export:apps/web', rule: 'lightsout/multi-export', folder: 'apps/web', blocking: [], advisories: [] };
	const group: StandardsGroup = {
		packages: ['', 'web'],
		pack: { name: 'lightsout/standards', topics: [], rules: [], conditionalPacks: [], inactiveRules: [] },
		states: new Map(),
	};
	const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false }, 'packages-dir': packagesDir };
	const tools = createBatchTools({
		cwd: '/repo',
		runId: 'run-1',
		driver: createUncalledDriver({ reason: 'the batch output review is stubbed, so no agent is spawned' }),
		config,
		batch,
		groups: [group],
		packagesDir,
		agentReview: true,
		checkAll: false,
		agentTimeoutMs: 60_000,
		attributedFiles: [],
		onProgress: () => undefined,
		recordUsage: async () => undefined,
	});

	return { tools, config };
};

describe('createBatchTools', () => {
	test('builds a batch review that grades by the configured packages-dir', async () => {
		const { tools } = setupBatchTools({ packagesDir: 'apps' });

		await tools.reviewOutput({ baseline: [] });

		expect(mockReviewBatchOutput).toHaveBeenCalledWith(expect.objectContaining({ packagesDir: 'apps', changedFiles: ['apps/web/src/index.ts'] }));
	});

	test('hands its config to the per-batch site re-check', async () => {
		const { tools, config } = setupBatchTools({ packagesDir: 'apps' });

		await tools.checkLive();

		expect(mockRunStandardsCheck.mock.calls[0]?.[0].config).toBe(config);
	});
});
