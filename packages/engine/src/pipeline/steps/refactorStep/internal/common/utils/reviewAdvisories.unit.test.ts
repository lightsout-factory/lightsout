import { describe, expect, jest, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { StandardsPackSource } from '#src/contracts/standards/StandardsPackSource.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { reviewAdvisories } from '#src/pipeline/steps/refactorStep/internal/common/utils/reviewAdvisories.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';

// Mocked Imports
// -------------------------
// The review runner spawns a harness and has its own tests; what this helper
// owns is what it hands over, observable with the runner stubbed.

interface RunStandardsReviewParams {
	cwd: string;
	driver: Driver;
	groups: StandardsGroup[];
	files: string[];
	packagesDir: string;
	timeoutMs?: number;
	onProgress?: (message: string) => void;
}

const mockRunStandardsReview = jest.fn<(params: RunStandardsReviewParams) => Promise<{ findings: StandardsFinding[]; notes: string[] }>>();

jest.mock('#src/standardsCheck/runStandardsReview.ts', () => ({
	runStandardsReview: (params: RunStandardsReviewParams) => mockRunStandardsReview(params),
}));
// -------------------------

/** A pipeline run carrying only what the review reads off it, with the packages dir the config sets. */
const setupRun = ({ packagesDir }: { packagesDir: string }) => {
	mockRunStandardsReview.mockResolvedValue({ findings: [], notes: [] });

	const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false }, 'packages-dir': packagesDir };
	const run = {
		cwd: '/repo',
		config,
		driver: { name: 'fake' },
		agentTimeoutMs: 1000,
		progress: jest.fn<(message: string) => void>(),
	} as unknown as PipelineRun;
	const groups: StandardsGroup[] = [
		{ packages: [''], pack: { name: 'lightsout/node', topics: [], rules: [] }, source: StandardsPackSource.Detected, states: new Map() },
	];

	return { run, groups };
};

describe('reviewAdvisories', () => {
	test("reviews with the run config's packages-dir", async () => {
		const { run, groups } = setupRun({ packagesDir: 'apps' });

		await reviewAdvisories({ run, groups, files: ['apps/web/src/index.ts'] });

		expect(mockRunStandardsReview).toHaveBeenCalledWith(expect.objectContaining({ packagesDir: 'apps' }));
	});
});
