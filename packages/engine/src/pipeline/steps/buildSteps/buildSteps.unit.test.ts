import { describe, expect, jest, test } from '@jest/globals';
import type { AcceptanceRow } from '#src/common/types/AcceptanceRow.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { LedgerRow } from '#src/contracts/plan/ledger/LedgerRow.ts';
import type { ApprovedTestRecord } from '#src/contracts/run/ApprovedTestRecord.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { StandardsSnapshot } from '#src/contracts/standardsCheck/StandardsSnapshot.ts';
import type { VerificationResult } from '#src/pipeline/internal/common/types/VerificationResult.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { PipelineStep } from '#src/pipeline/internal/PipelineStep.ts';
import { buildSteps } from '#src/pipeline/steps/buildSteps/buildSteps.ts';

// Mocked Imports
// -------------------------
// The ledger writer has its own tests against a real repository. What is under
// test here is only the move list the build hands it, so the factory is
// captured and hands back a step that does nothing.
interface LedgerWriterParams {
	run: PipelineRun;
	gitPrefix?: string;
	planContent: string;
	overviewContent?: string;
	rows: LedgerRow[];
	testStandards?: string;
	movePaths?: { from: string; to: string }[];
	deletePaths?: string[];
}

const mockWriteLedgerTestsStep = jest.fn<(params: LedgerWriterParams) => PipelineStep['run']>();

jest.mock('#src/pipeline/internal/steps/writeLedgerTestsStep.ts', () => ({
	writeLedgerTestsStep: (params: LedgerWriterParams) => mockWriteLedgerTestsStep(params),
}));
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
const mockReadGitChangedFiles = jest.fn<(params: { cwd: string }) => Promise<string[] | undefined>>();

jest.mock('#src/common/git/readGitChangedFiles.ts', () => ({
	readGitChangedFiles: (params: { cwd: string }) => mockReadGitChangedFiles(params),
}));
// -------------------------
const mockApproveTestFiles = jest.fn<(params: { run: PipelineRun; paths: string[] }) => Promise<ApprovedTestRecord[]>>();

jest.mock('#src/pipeline/approvedTests/approveTestFiles.ts', () => ({
	approveTestFiles: (params: { run: PipelineRun; paths: string[] }) => mockApproveTestFiles(params),
}));
// -------------------------
interface StandardsCheckParams {
	cwd: string;
	config: LightsoutConfig | undefined;
	path?: string;
	all?: boolean;
	writeBaseline?: boolean;
	persist?: boolean;
	onProgress?: (message: string) => void;
}

const mockRunStandardsCheck = jest.fn<(params: StandardsCheckParams) => Promise<{ findings: StandardsFinding[]; notes: string[] }>>();

jest.mock('#src/standardsCheck/runStandardsCheck.ts', () => ({
	runStandardsCheck: (params: StandardsCheckParams) => mockRunStandardsCheck(params),
}));
// -------------------------
const mockWriteRunStandardsBaseline = jest.fn<(params: { cwd: string; runId: string; snapshot: StandardsSnapshot }) => Promise<void>>();

jest.mock('#src/runState/standardsBaseline/writeRunStandardsBaseline.ts', () => ({
	writeRunStandardsBaseline: (params: { cwd: string; runId: string; snapshot: StandardsSnapshot }) => mockWriteRunStandardsBaseline(params),
}));
// -------------------------

/** Two ledger rows; the first's test file sits under the folder `standardPlanWithMoves` moves. */
const ledgerSection = [
	'## Acceptance Tests',
	'',
	'| Criterion | Test file | Test name | Gate |',
	'| --- | --- | --- | --- |',
	'| A widget renders | `src/modern/widget.unit.test.ts` | widget: renders | test |',
	'| A gadget renders | `src/gadget.unit.test.ts` | gadget: renders | test |',
	'',
];

const standardPlan = ['# Plan: render the widget', '', ...ledgerSection].join('\n');
const standardPlanWithoutLedger = ['# Plan: render the widget', ''].join('\n');
const renamesOnlyPlan = ['# Plan: rename feature to widget', '', '## Renames', '', '- `feature` → `widget`', '', ...ledgerSection].join('\n');
const moveFoldersAndFilesPlan = [
	'# Plan: move the feature folder to widget',
	'',
	'## Build Mode',
	'',
	'move-folders-and-files',
	'',
	'## Files to Move',
	'',
	'### `src/feature/` → `src/widget/`',
	'',
	...ledgerSection,
].join('\n');

/** A standard plan that moves a folder holding a ledger row's test file, beside a test-side and a source file move. */
const standardPlanWithMoves = [
	'# Plan: move the legacy specs',
	'',
	'## Files to Move',
	'',
	'### `src/legacy/` → `src/modern/`',
	'',
	'### `src/old.unit.test.ts` → `src/new.unit.test.ts`',
	'',
	'### `src/old.ts` → `src/new.ts`',
	'',
	...ledgerSection,
].join('\n');

/**
 * A PipelineRun stub carrying only what building the steps reads: the config,
 * the run id the self-check command names, and the changed files the
 * write-tests skip asks about.
 */
const setupBuild = () => {
	mockWriteLedgerTestsStep.mockReturnValue(async () => undefined);

	const manifest = { runId: 'run-1', acceptanceTests: [], changedFiles: ['src/widget.ts'] };
	const run = {
		cwd: '/tmp/lightsout-build-steps',
		config: { gates: {} },
		current: () => manifest,
	} as unknown as PipelineRun;

	return { run };
};

const standardIds = [
	'clean-slate',
	'write-ledger-tests',
	'implement',
	'format-implement',
	'verify-implement',
	'write-tests',
	'format-tests',
	'verify-tests',
	'refactor',
	'format-refactor',
	'verify-refactor',
];
const mechanicalIds = standardIds.filter((id) => !id.includes('refactor'));

const contextOnlyPlan = '# Widget\n\n## Context\n\nAdds a widget.\n';

/**
 * A PipelineRun stub for a clean-slate that reaches its passed stamp: green
 * gates, a dirty tree as git reports it, and the patch the step writes captured
 * so the baseline and the approvals can be read back.
 */
const setupBuildSteps = ({ generated, dirtyFiles }: { generated: string[] | undefined; dirtyFiles: string[] }) => {
	mockRunVerificationGates.mockResolvedValue({
		error: undefined,
		failedFamilies: [],
		crashes: [],
		timeouts: [],
		coordination: undefined,
		failures: [],
		gates: [],
	});
	mockReadGitChangedFiles.mockResolvedValue(dirtyFiles);
	mockApproveTestFiles.mockImplementation(async ({ paths }) => paths.map((path) => ({ path, sha256: 'a'.repeat(64), removed: false })));
	mockRunStandardsCheck.mockResolvedValue({ findings: [], notes: [] });
	mockWriteRunStandardsBaseline.mockResolvedValue(undefined);

	const manifest = {
		runId: 'run-1',
		steps: [],
		changedFiles: [],
		packages: [],
		baselineDirtyFiles: dirtyFiles,
		approvedTests: [],
		acceptanceTests: [],
		currentStep: null,
	} as unknown as RunManifest;
	const patches: Partial<RunManifest>[] = [];

	const run = {
		cwd: '/tmp/lightsout-build-steps',
		config: { gates: {}, ...(generated === undefined ? {} : { generated }) } as unknown as LightsoutConfig,
		current: () => manifest,
		progress: () => undefined,
		nextRecord: ({ id }: { id: string }) => ({ id, status: RunStatus.Running, attempts: 1 }),
		setStep: async ({ record, patch }: { record: StepRecord; patch?: Partial<RunManifest> }) => {
			manifest.steps = [record];

			if (patch) {
				patches.push(patch);
			}
		},
	};

	return { run: run as unknown as PipelineRun, patches };
};

describe('buildSteps', () => {
	test.each([
		{ mode: 'standard', planContent: standardPlan, ids: standardIds, ledgerSkip: undefined, testsSkip: undefined },
		{
			mode: 'standard without a ledger',
			planContent: standardPlanWithoutLedger,
			ids: standardIds,
			ledgerSkip: expect.stringMatching(/no acceptance-test ledger/),
			testsSkip: undefined,
		},
		{
			mode: 'rename-only',
			planContent: renamesOnlyPlan,
			ids: mechanicalIds,
			ledgerSkip: expect.stringMatching(/rename-only/),
			testsSkip: expect.stringMatching(/rename-only/),
		},
		{
			mode: 'move-folders-and-files',
			planContent: moveFoldersAndFilesPlan,
			ids: mechanicalIds,
			ledgerSkip: expect.stringMatching(/move-folders-and-files/),
			testsSkip: expect.stringMatching(/move-folders-and-files/),
		},
	])('buildSteps: a $mode plan builds its steps and skips its test writers by its mode', ({ planContent, ids, ledgerSkip, testsSkip }) => {
		const { run } = setupBuild();

		const steps = buildSteps({ run, planContent });

		// A mechanical mode leaves out the refactor steps though the run was not
		// asked to skip them, and its writers name the mode as the reason they
		// write nothing, even beside a ledger the plan carries.
		expect({
			ids: steps.map((step) => step.id),
			ledgerSkip: steps.find((step) => step.id === 'write-ledger-tests')?.skip?.(),
			testsSkip: steps.find((step) => step.id === 'write-tests')?.skip?.(),
		}).toEqual({ ids, ledgerSkip, testsSkip });
	});

	test('buildSteps: the ledger writer is handed each ledger test file a folder move carries, paired with its committed source', () => {
		const { run } = setupBuild();

		buildSteps({ run, planContent: standardPlanWithMoves });

		// The plan's test-side file move stays, its source file move is dropped,
		// and the ledger row under the moved folder is paired with the path it
		// held at the phase's start; the row no move covers gets no pair.
		expect(mockWriteLedgerTestsStep.mock.calls.map(([params]) => params.movePaths)).toStrictEqual([
			[
				{ from: 'src/old.unit.test.ts', to: 'src/new.unit.test.ts' },
				{ from: 'src/legacy/widget.unit.test.ts', to: 'src/modern/widget.unit.test.ts' },
			],
		]);
	});

	test.each([
		{ scope: 'outside the configured generated entry', generated: ['dist/'], approved: ['src/widget.unit.test.ts'] },
		{ scope: 'anywhere when no generated entries are configured', generated: undefined, approved: ['dist/widget.unit.test.js', 'src/widget.unit.test.ts'] },
	])('its clean-slate step keeps every dirty file in the baseline and approves test files $scope', async ({ generated, approved }) => {
		const { run, patches } = setupBuildSteps({ generated, dirtyFiles: ['dist/widget.unit.test.js', 'src/widget.unit.test.ts'] });

		const steps = buildSteps({ run, planContent: contextOnlyPlan });
		const cleanSlate = steps.find((step) => step.id === 'clean-slate');
		const outcome = await cleanSlate?.run();

		expect({
			outcome,
			approvedPaths: mockApproveTestFiles.mock.calls.map(([params]) => params.paths),
			baselineDirtyFiles: patches.at(-1)?.baselineDirtyFiles,
		}).toStrictEqual({
			outcome: undefined,
			approvedPaths: [approved],
			baselineDirtyFiles: ['dist/widget.unit.test.js', 'src/widget.unit.test.ts'],
		});
	});
});
