import { describe, expect, jest, test } from '@jest/globals';
import type { LedgerRow } from '#src/contracts/plan/ledger/LedgerRow.ts';
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
});
