import { describe, expect, jest, test } from '@jest/globals';
import type { AcceptanceRow } from '#src/common/types/AcceptanceRow.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import type { VerificationResult } from '#src/pipeline/internal/common/types/VerificationResult.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { verifyStep } from '#src/pipeline/steps/verifyStep/verifyStep.ts';
import { createUncalledDriver } from '#tests/helpers/createUncalledDriver.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

// Mocked Imports
// -------------------------
// The test-change review is not what these tests are about; it answers clean so
// the checkpoint goes straight to its gates.
interface ReviewParams {
	run: PipelineRun;
	checkpoint: string;
	planContent: string;
	overviewContent?: string;
}

const mockReviewTestChanges = jest.fn<(params: ReviewParams) => Promise<{ error?: string; rateLimited?: boolean }>>();

jest.mock('#src/pipeline/approvedTests/reviewTestChanges.ts', () => ({ reviewTestChanges: (params: ReviewParams) => mockReviewTestChanges(params) }));
// -------------------------
interface GateParams {
	run: PipelineRun;
	coverage?: boolean;
	checkpoint: string;
	rows: AcceptanceRow[];
	final?: boolean;
}

const mockRunVerificationGates = jest.fn<(params: GateParams) => Promise<VerificationResult>>();

jest.mock('#src/pipeline/internal/common/utils/runVerificationGates.ts', () => ({
	runVerificationGates: (params: GateParams) => mockRunVerificationGates(params),
}));
// -------------------------

const checkpoint = 'verify-implement';

const redGates: VerificationResult = {
	error: 'test suite failed',
	failedFamilies: ['test'],
	crashes: [],
	timeouts: [],
	coordination: undefined,
	failures: [],
	gates: [],
};

const greenGates: VerificationResult = { error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined, failures: [], gates: [] };

/**
 * A checkpoint over a real git repo whose first gate run is red and whose fix
 * role edits `src/index.js` and reports `reported` as its changed files; the
 * gates are green after the fix. Every manifest patch and narrated line is kept.
 */
const setupFixedRun = ({ reported }: { reported: string[] }) => {
	mockReviewTestChanges.mockResolvedValue({});
	mockRunVerificationGates.mockResolvedValueOnce(redGates);
	mockRunVerificationGates.mockResolvedValue(greenGates);

	const cwd = setupConsumerRepo();
	const manifest = {
		runId: 'run-1',
		currentStep: checkpoint,
		steps: [],
		changedFiles: [],
		packages: [],
		baselineDirtyFiles: [],
		acceptanceTests: [],
		approvedTests: [],
	} as unknown as RunManifest;
	const patches: Partial<RunManifest>[] = [];
	const progressLines: string[] = [];

	const run = {
		cwd,
		config: { gates: {} } as unknown as LightsoutConfig,
		driver: createUncalledDriver({ reason: 'the fix role is answered by invokeRole, and a green after it buys no supervisor' }),
		current: () => manifest,
		progress: (message: string) => {
			progressLines.push(message);
		},
		parkMessage: () => 'run parked',
		nextRecord: ({ id }: { id: string }) => ({ id, status: RunStatus.Running, attempts: 1 }),
		setStep: async ({ record, patch }: { record: StepRecord; patch?: Partial<RunManifest> }) => {
			manifest.steps = [record];

			if (patch) {
				patches.push(patch);
				Object.assign(manifest, patch);
			}
		},
		update: async () => {},
		stop: async ({ error }: { status: RunStatus; error: string }) => ({ ok: false as const, manifest, error }),
		invokeRole: async () => {
			writeRepoFile({ cwd, path: 'src/index.js', content: 'export const one = 2;\n' });

			return {
				ok: true as const,
				report: {
					status: WorkReportStatus.Complete,
					changedFiles: reported.map((path) => ({ path, summary: 'fixed' })),
					summary: 'fixed the red test',
					failures: [],
				},
			};
		},
		openStepLevel: () => undefined,
		agentEventSink: () => () => {},
		persistRejected: () => async () => {},
		recordUsage: async () => {},
	};

	return { run: run as unknown as PipelineRun, manifest, patches, progressLines };
};

describe('verifyStep', () => {
	test("records the fix role's real changed files and names the reported entries that are not files in one warning line", async () => {
		const { run, manifest, patches, progressLines } = setupFixedRun({ reported: ['src/index.js', 'fixed the failing assertion', 'src/ghost.js'] });

		const outcome = await verifyStep({
			run,
			planContent: '# Plan',
			id: checkpoint,
			acceptanceTests: () => [],
			renames: [],
			buildFix: () => ({ systemPrompt: 'fix the gates', prompt: 'fix the gates' }),
		})();

		expect({
			outcome,
			status: manifest.steps[0]?.status,
			changedFiles: patches.map((patch) => patch.changedFiles),
			warnings: progressLines.filter((line) => line.startsWith('warning unreal-reported-paths:')),
		}).toEqual({
			outcome: undefined,
			status: RunStatus.Passed,
			changedFiles: [['src/index.js']],
			warnings: [expect.stringMatching(/^warning unreal-reported-paths: verify-implement .*\b2\b.*"fixed the failing assertion".*"src\/ghost\.js"/)],
		});
	});

	test('narrates no warning when every entry the fix role reports is a real file', async () => {
		const { run, patches, progressLines } = setupFixedRun({ reported: ['./src/index.js'] });

		const outcome = await verifyStep({
			run,
			planContent: '# Plan',
			id: checkpoint,
			acceptanceTests: () => [],
			renames: [],
			buildFix: () => ({ systemPrompt: 'fix the gates', prompt: 'fix the gates' }),
		})();

		expect({
			outcome,
			changedFiles: patches.map((patch) => patch.changedFiles),
			warnings: progressLines.filter((line) => line.startsWith('warning unreal-reported-paths:')),
		}).toStrictEqual({
			outcome: undefined,
			changedFiles: [['src/index.js']],
			warnings: [],
		});
	});
});
