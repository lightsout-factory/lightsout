import { describe, expect, jest, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { StandardsSnapshot } from '#src/contracts/standardsCheck/StandardsSnapshot.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { refactorStep } from '#src/pipeline/steps/refactorStep/refactorStep.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import { createUncalledDriver } from '#tests/helpers/createUncalledDriver.ts';

// Mocked Imports
// -------------------------
// The resolver is the collaborator under examination: these tests pin the
// package scope the step hands it.
interface ResolveStandardsGroupsParams {
	cwd: string;
	config: LightsoutConfig | undefined;
	packages?: string[];
}

const mockResolveStandardsGroups = jest.fn<(params: ResolveStandardsGroupsParams) => Promise<StandardsGroup[]>>();

jest.mock('#src/standards/resolveStandardsGroups.ts', () => ({
	resolveStandardsGroups: (params: ResolveStandardsGroupsParams) => mockResolveStandardsGroups(params),
}));
// -------------------------
// The review, the standards check and the baseline read are stubbed so the
// step ends at once with no work, spending no agent and running no check.
interface ReviewAdvisoriesParams {
	run: PipelineRun;
	groups: StandardsGroup[];
	files: string[];
}

const mockReviewAdvisories = jest.fn<(params: ReviewAdvisoriesParams) => Promise<StandardsFinding[]>>();

jest.mock('#src/pipeline/steps/refactorStep/internal/common/utils/reviewAdvisories.ts', () => ({
	reviewAdvisories: (params: ReviewAdvisoriesParams) => mockReviewAdvisories(params),
}));
// -------------------------
interface StandardsWorkListParams {
	run: PipelineRun;
	baseline: StandardsFinding[] | undefined;
}

interface StandardsWorkList {
	workList: StandardsFinding[];
	advisories: StandardsFinding[];
	inherited: StandardsFinding[];
	uncertain: StandardsFinding[];
}

const mockStandardsWorkList = jest.fn<(params: StandardsWorkListParams) => Promise<StandardsWorkList>>();

jest.mock('#src/pipeline/steps/refactorStep/internal/common/utils/standardsWorkList.ts', () => ({
	standardsWorkList: (params: StandardsWorkListParams) => mockStandardsWorkList(params),
}));
// -------------------------
const mockReadRunStandardsBaseline = jest.fn<(params: { cwd: string; runId: string }) => Promise<StandardsSnapshot | undefined>>();

jest.mock('#src/runState/standardsBaseline/readRunStandardsBaseline.ts', () => ({
	readRunStandardsBaseline: (params: { cwd: string; runId: string }) => mockReadRunStandardsBaseline(params),
}));
// -------------------------

/**
 * A run with no changed files over a `PipelineRun` stub whose driver throws, so
 * the step reads no file and an agent these tests never expect is loud if it is
 * spawned.
 */
const setupRefactorRun = ({ packages }: { packages: string[] }) => {
	mockResolveStandardsGroups.mockResolvedValue([]);
	mockReviewAdvisories.mockResolvedValue([]);
	mockStandardsWorkList.mockResolvedValue({ workList: [], advisories: [], inherited: [], uncertain: [] });
	mockReadRunStandardsBaseline.mockResolvedValue(undefined);

	const manifest = { runId: 'run-1', steps: [], changedFiles: [], packages, acceptanceTests: [], approvedTests: [] } as unknown as RunManifest;
	const config = { 'standards-pack': 'lightsout/node' } as unknown as LightsoutConfig;
	const cwd = '/tmp/lightsout-refactor-step-standards-scope';
	const run = {
		cwd,
		config,
		agentTimeoutMs: 60_000,
		driver: createUncalledDriver({ reason: 'the refactor step reaches its agents through stubbed collaborators here' }),
		current: () => manifest,
		progress: () => {},
		nextRecord: ({ id }: { id: string }) => ({ id, status: RunStatus.Running, attempts: 1 }),
		setStep: async ({ record }: { record: StepRecord }) => {
			manifest.steps = [record];
		},
	};
	const step = refactorStep({ run: run as unknown as PipelineRun, planContent: '# Plan' });

	return { step, cwd, config };
};

describe('refactorStep', () => {
	test.each([
		{ scope: ['api'], expectedPackages: ['api'] },
		{ scope: [], expectedPackages: undefined },
	])("refactorStep: resolves the review's groups for the run's current package scope", async ({ scope, expectedPackages }) => {
		const { step, cwd, config } = setupRefactorRun({ packages: scope });

		await step();

		expect(mockResolveStandardsGroups.mock.calls).toEqual([[{ cwd, config, packages: expectedPackages }]]);
	});
});
