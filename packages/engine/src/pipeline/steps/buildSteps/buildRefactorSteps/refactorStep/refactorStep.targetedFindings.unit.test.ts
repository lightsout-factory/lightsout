import { describe, expect, jest, test } from '@jest/globals';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { StandardsSnapshot } from '#src/contracts/standardsCheck/StandardsSnapshot.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import { refactorStep } from '#src/pipeline/steps/buildSteps/buildRefactorSteps/refactorStep/refactorStep.ts';
import type { runExecutorPass } from '#src/pipeline/steps/refactorStep/runCleanupRound/runExecutorPass.ts';
import { cleanupRecordOf } from '#tests/helpers/cleanupRecordOf.ts';
import { countableFindings } from '#tests/helpers/countableFindings.ts';
import { createUncalledDriver } from '#tests/helpers/createUncalledDriver.ts';

// Mocked Imports
// -------------------------
// The executor pass is the agent boundary: stubbed so each round "edits" the
// files of the findings it was handed, which counts as a changed round, while
// the real `runCleanupRound` persists the cleanup record before calling it.
type ExecutorPassParams = Parameters<typeof runExecutorPass>[0];

const mockRunExecutorPass = jest.fn<typeof runExecutorPass>();

jest.mock('#src/pipeline/steps/refactorStep/runCleanupRound/runExecutorPass.ts', () => ({
	runExecutorPass: (params: ExecutorPassParams) => mockRunExecutorPass(params),
}));
// -------------------------
interface ResolveStandardsGroupsParams {
	cwd: string;
	config: LightsoutConfig | undefined;
	packages?: string[];
}

const mockResolveStandardsGroups = jest.fn<(params: ResolveStandardsGroupsParams) => Promise<StandardsGroup[]>>();

jest.mock('#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts', () => ({
	resolveStandardsGroups: (params: ResolveStandardsGroupsParams) => mockResolveStandardsGroups(params),
}));
// -------------------------
interface ReviewAdvisoriesParams {
	run: PipelineRun;
	groups: StandardsGroup[];
	files: string[];
}

const mockReviewAdvisories = jest.fn<(params: ReviewAdvisoriesParams) => Promise<StandardsFinding[]>>();

jest.mock('#src/pipeline/steps/refactorStep/reviewAdvisories.ts', () => ({
	reviewAdvisories: (params: ReviewAdvisoriesParams) => mockReviewAdvisories(params),
}));
// -------------------------
// The standards check answers one work list per call, in the order the test
// gives them; the last answer is empty so the loop ends clean.
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

jest.mock('#src/pipeline/steps/refactorStep/standardsWorkList.ts', () => ({
	standardsWorkList: (params: StandardsWorkListParams) => mockStandardsWorkList(params),
}));
// -------------------------
const mockReadRunStandardsBaseline = jest.fn<(params: { cwd: string; runId: string }) => Promise<StandardsSnapshot | undefined>>();

jest.mock('#src/runState/standardsBaseline/readRunStandardsBaseline.ts', () => ({
	readRunStandardsBaseline: (params: { cwd: string; runId: string }) => mockReadRunStandardsBaseline(params),
}));
// -------------------------

const [findingX, findingY] = countableFindings({ count: 2, rule: 'acme/max-nesting' });

interface SetupParams {
	/** One work list per round, in order; an empty list is appended so cleanup ends clean. */
	rounds: StandardsFinding[][];
	/** The refactor step's report a parked run left on disk, for a resume. */
	priorReport?: Record<string, unknown>;
}

/**
 * A run over a `PipelineRun` stub whose driver throws, recording every step
 * record the step persists in order, so a test can read the record written
 * before a round as well as the one the step finished with.
 */
const setupTargetedCleanup = ({ rounds, priorReport }: SetupParams) => {
	mockResolveStandardsGroups.mockResolvedValue([]);
	mockReviewAdvisories.mockResolvedValue([]);
	mockReadRunStandardsBaseline.mockResolvedValue(undefined);
	mockStandardsWorkList.mockReset();

	for (const workList of [...rounds, []]) {
		mockStandardsWorkList.mockResolvedValueOnce({ workList, advisories: [], inherited: [], uncertain: [] });
	}

	mockRunExecutorPass.mockImplementation(async ({ record, findings }) => ({
		record,
		edited: findings.flatMap((finding) => finding.files.map((file) => file.path)),
	}));

	const priorSteps = priorReport === undefined ? [] : [{ id: 'refactor', status: RunStatus.PausedRateLimit, attempts: 1, report: priorReport }];
	const manifest = { runId: 'run-1', steps: priorSteps, changedFiles: [], packages: [], acceptanceTests: [], approvedTests: [] } as unknown as RunManifest;
	const persisted: StepRecord[] = [];
	const run = {
		cwd: '/tmp/lightsout-refactor-step-targeted-findings',
		config: { 'standards-pack': 'lightsout/standards' } as unknown as LightsoutConfig,
		agentTimeoutMs: 60_000,
		driver: createUncalledDriver({ reason: 'the refactor step reaches its agents through stubbed collaborators here' }),
		current: () => manifest,
		progress: () => {},
		nextRecord: ({ id }: { id: string }) => ({ id, status: RunStatus.Running, attempts: 1 }),
		setStep: async ({ record }: { record: StepRecord }) => {
			persisted.push(record);
			manifest.steps = [record];
		},
	};
	const step = refactorStep({ run: run as unknown as PipelineRun, planContent: '# Plan' });

	return { step, persisted, manifest };
};

describe('refactorStep', () => {
	test("refactorStep: records each round's work list once per siteKey, persisted before the round runs", async () => {
		const { step, persisted, manifest } = setupTargetedCleanup({ rounds: [[findingX], [findingX, findingY]] });

		await step();

		expect({
			beforeFirstRound: cleanupRecordOf({ steps: persisted.slice(0, 1) })?.targeted,
			final: cleanupRecordOf({ steps: manifest.steps })?.targeted,
		}).toEqual({ beforeFirstRound: [findingX], final: [findingX, findingY] });
	});

	test('refactorStep: a resume keeps the targeted findings the prior record carried', async () => {
		const { step, manifest } = setupTargetedCleanup({
			rounds: [[findingY]],
			priorReport: {
				roundsUsed: 1,
				remaining: [findingX],
				inherited: [],
				uncertain: [],
				failures: [],
				initialReview: [],
				finalReview: [],
				targeted: [findingX],
			},
		});

		await step();

		expect(cleanupRecordOf({ steps: manifest.steps })?.targeted).toEqual([findingX, findingY]);
	});
});
