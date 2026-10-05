import { expect, jest, test } from '@jest/globals';
import { BuildMode } from '#src/common/constants/BuildMode.ts';
import type { GateRunResult } from '#src/common/types/GateRunResult.ts';
import type { GateResult } from '#src/contracts/gates/GateResult.ts';
import type { RenameRule } from '#src/contracts/plan/renames/RenameRule.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import { reviewAndVerify } from '#src/pipeline/steps/verify/reviewAndVerify/reviewAndVerify.ts';

// Mocked Imports
// -------------------------
// The review has its own tests and its own verdict rules. What is under test
// here is only what the checkpoint does with the answer, so the call is
// captured and the answer is handed back directly.
interface ReviewParams {
	run: PipelineRun;
	checkpoint: string;
	planContent: string;
	overviewContent?: string;
}

const mockReviewTestChanges = jest.fn<(params: ReviewParams) => Promise<{ error?: string; rateLimited?: boolean }>>();

jest.mock('#src/pipeline/approvedTests/reviewTestChanges/reviewTestChanges.ts', () => ({
	reviewTestChanges: (params: ReviewParams) => mockReviewTestChanges(params),
}));
// -------------------------
// The rename check has its own tests against a real repository. Here it is only
// the judgment a rename-only checkpoint asks in place of the review.
interface RenameCheckParams {
	run: PipelineRun;
	checkpoint: string;
	renames: RenameRule[];
}

const mockCheckRenameOnlyChanges = jest.fn<(params: RenameCheckParams) => Promise<{ error?: string }>>();

jest.mock('#src/pipeline/renameCheck/checkRenameOnlyChanges/checkRenameOnlyChanges.ts', () => ({
	checkRenameOnlyChanges: (params: RenameCheckParams) => mockCheckRenameOnlyChanges(params),
}));
// -------------------------
// The move check has its own tests against a real repository. Here it is only
// the judgment a move-folders-and-files checkpoint asks in place of the review.
interface MoveCheckParams {
	run: PipelineRun;
	checkpoint: string;
	fileMoves: { from: string; to: string }[];
	folderMoves: { from: string; to: string }[];
}

const mockCheckMoveOnlyChanges = jest.fn<(params: MoveCheckParams) => Promise<{ error?: string }>>();

jest.mock('#src/pipeline/moveCheck/checkMoveOnlyChanges/checkMoveOnlyChanges.ts', () => ({
	checkMoveOnlyChanges: (params: MoveCheckParams) => mockCheckMoveOnlyChanges(params),
}));
// -------------------------
interface GateParams {
	run: PipelineRun;
	coverage?: boolean;
	checkpoint: string;
	rows: { testFile: string; testName: string; gate: string }[];
	final?: boolean;
}

type GateOutcome = GateRunResult & { failures: GateResult[]; gates: GateResult[] };

const mockRunVerificationGates = jest.fn<(params: GateParams) => Promise<GateOutcome>>();

jest.mock('#src/pipeline/steps/common/runVerificationGates.ts', () => ({
	runVerificationGates: (params: GateParams) => mockRunVerificationGates(params),
}));
// -------------------------
const mockApproveRunnerSnapshots = jest.fn<(params: { run: PipelineRun }) => Promise<number>>();

jest.mock('#src/pipeline/steps/verify/reviewAndVerify/approveRunnerSnapshots.ts', () => ({
	approveRunnerSnapshots: (params: { run: PipelineRun }) => mockApproveRunnerSnapshots(params),
}));
// -------------------------

const greenGates: GateOutcome = { error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined, failures: [], gates: [] };

const renames: RenameRule[] = [{ from: 'widgetName', to: 'gadgetName', line: 12 }];

const fileMoves = [{ from: 'packages/engine/src/widget.ts', to: 'packages/engine/src/gadget.ts' }];
const folderMoves = [{ from: 'packages/engine/src/widgets', to: 'packages/engine/src/gadgets' }];

/**
 * One checkpoint of a move-folders-and-files plan: the move check answers where
 * the review would, and the review and the rename check are wired to pass so
 * that a call reaching either is visible only as a call, never as a changed
 * verdict.
 */
const setupMoveCheckpoint = ({ moveCheck = {} }: { moveCheck?: { error?: string } } = {}) => {
	mockCheckMoveOnlyChanges.mockResolvedValue(moveCheck);
	mockCheckRenameOnlyChanges.mockResolvedValue({});
	mockReviewTestChanges.mockResolvedValue({});
	mockRunVerificationGates.mockResolvedValue(greenGates);
	mockApproveRunnerSnapshots.mockResolvedValue(0);

	const manifest = { runId: 'run-1', steps: [], changedFiles: [], packages: [] } as unknown as RunManifest;
	const run = {
		cwd: '/tmp/lightsout-review-and-verify',
		current: () => manifest,
		progress: () => {},
	} as unknown as PipelineRun;

	return { run, acceptanceTests: () => [] };
};

test('reviewAndVerify: a move-folders-and-files checkpoint refused by the move check goes red under move-check with no review and no gate', async () => {
	const { run, acceptanceTests } = setupMoveCheckpoint({
		moveCheck: { error: 'move check refused this checkpoint and no gate ran: packages/engine/src/gadget.ts added `3` ×1, removed `2` ×1' },
	});

	const refusal = await reviewAndVerify({
		run,
		id: 'verify-implement',
		coverage: false,
		final: false,
		planContent: '# Plan',
		overviewContent: '# Overview',
		acceptanceTests,
		planBuildMode: { buildMode: BuildMode.MoveFoldersAndFiles, fileMoves, folderMoves },
	});

	// A change the declared moves do not explain is refused before any gate is
	// spent, in the same shape a refused review takes, and neither the review
	// nor the rename check is asked in its place.
	expect({
		refusal,
		reviewCalls: mockReviewTestChanges.mock.calls.length,
		renameCheckCalls: mockCheckRenameOnlyChanges.mock.calls.length,
		gateCalls: mockRunVerificationGates.mock.calls.length,
	}).toStrictEqual({
		refusal: {
			error: 'move check refused this checkpoint and no gate ran: packages/engine/src/gadget.ts added `3` ×1, removed `2` ×1',
			failedFamilies: ['move-check'],
			crashes: [],
			timeouts: [],
			coordination: undefined,
			failures: [],
		},
		reviewCalls: 0,
		renameCheckCalls: 0,
		gateCalls: 0,
	});
});

test('reviewAndVerify: a move-folders-and-files checkpoint runs the move check in place of the test-change review', async () => {
	const moveOnly = setupMoveCheckpoint();

	const moveOnlyResult = await reviewAndVerify({
		run: moveOnly.run,
		id: 'verify-tests',
		coverage: true,
		final: true,
		planContent: '# Plan',
		overviewContent: '# Overview',
		acceptanceTests: moveOnly.acceptanceTests,
		planBuildMode: { buildMode: BuildMode.MoveFoldersAndFiles, fileMoves, folderMoves },
	});

	// A passing move check hands over to the gates with the per-file executed
	// check lifted, since the phase writes no tests, and no agent reads the diff.
	expect({
		result: moveOnlyResult,
		moveCheckCalls: mockCheckMoveOnlyChanges.mock.calls,
		renameCheckCalls: mockCheckRenameOnlyChanges.mock.calls.length,
		reviewCalls: mockReviewTestChanges.mock.calls.length,
		gateCalls: mockRunVerificationGates.mock.calls.length,
	}).toStrictEqual({
		result: greenGates,
		moveCheckCalls: [[{ run: moveOnly.run, checkpoint: 'verify-tests', fileMoves, folderMoves }]],
		renameCheckCalls: 0,
		reviewCalls: 0,
		gateCalls: 1,
	});
	expect(mockRunVerificationGates).toHaveBeenCalledWith(
		expect.objectContaining({ run: moveOnly.run, checkpoint: 'verify-tests', coverage: true, final: true, changedFilesExecuted: false }),
	);

	const renameOnly = setupMoveCheckpoint();

	await reviewAndVerify({
		run: renameOnly.run,
		id: 'verify-tests',
		coverage: true,
		final: true,
		planContent: '# Plan',
		overviewContent: '# Overview',
		acceptanceTests: renameOnly.acceptanceTests,
		planBuildMode: { buildMode: BuildMode.RenamesOnly, renames },
	});

	// A rename-only checkpoint keeps the per-file executed check exactly as today.
	expect(mockRunVerificationGates).toHaveBeenLastCalledWith(expect.objectContaining({ run: renameOnly.run, changedFilesExecuted: true }));

	const standard = setupMoveCheckpoint();

	await reviewAndVerify({
		run: standard.run,
		id: 'verify-tests',
		coverage: true,
		final: true,
		planContent: '# Plan',
		overviewContent: '# Overview',
		acceptanceTests: standard.acceptanceTests,
		planBuildMode: { buildMode: BuildMode.Standard },
	});

	// So does a standard checkpoint, and across all three the move check was
	// asked only once: by the move-folders-and-files checkpoint.
	expect(mockRunVerificationGates).toHaveBeenLastCalledWith(expect.objectContaining({ run: standard.run, changedFilesExecuted: true }));
	expect(mockCheckMoveOnlyChanges).toHaveBeenCalledTimes(1);
});
