import type { RunProgress } from '#src/common/types/RunProgress.ts';
import type { RunProgressRow } from '#src/common/types/RunProgressRow.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';

/** One passed step row of a second's work, with whatever the run below varies laid over it. */
const rowOf = (overrides: Partial<RunProgressRow> = {}): RunProgressRow => ({
	id: 'implement',
	status: RunStatus.Passed,
	attempts: 1,
	durationMs: 1_000,
	verification: undefined,
	cleanup: undefined,
	...overrides,
});

/** The run the chosen progress-block layout was drawn against — same ids, statuses, attempt counts and durations. */
export const sampleRunProgress = (overrides: Partial<RunProgress> = {}): RunProgress => ({
	runId: 'e643832a-0000-4000-8000-000000000000',
	shortId: 'e643832a',
	title: 'phase 8 · plans',
	status: RunStatus.Running,
	live: true,
	rows: [
		rowOf({ id: 'clean-slate', durationMs: 160_000 }),
		rowOf({ id: 'implement', durationMs: 1_951_000 }),
		rowOf({ id: 'verify-implement', attempts: 2, durationMs: 651_000 }),
		rowOf({ id: 'write-tests', durationMs: 581_000 }),
		rowOf({ id: 'verify-tests', attempts: 2, durationMs: 542_000 }),
		rowOf({ id: 'refactor', status: RunStatus.Running, durationMs: 0 }),
		rowOf({ id: 'verify-refactor', status: undefined, attempts: 0, durationMs: undefined }),
		rowOf({ id: 'format', status: undefined, attempts: 0, durationMs: undefined }),
	],
	elapsedMs: 4_203_000,
	changedFileCount: 79,
	costUsd: 43.54,
	now: 'step refactor — pass 1/3',
	awaitingShip: false,
	resumeCommand: 'lightsout resume --run e643832a-0000-4000-8000-000000000000',
	...overrides,
});
