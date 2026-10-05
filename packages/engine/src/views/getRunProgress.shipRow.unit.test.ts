import { describe, expect, test } from '@jest/globals';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { getRunProgress } from '#src/views/getRunProgress.ts';
import { runProgressManifestOf as manifestOf } from '#tests/helpers/runProgressManifestOf.ts';
import { setupRunProgress as setupProgress } from '#tests/helpers/setupRunProgress.ts';

const stepOf = (overrides: Partial<StepRecord> = {}): StepRecord => ({
	id: 'implement',
	status: RunStatus.Passed,
	attempts: 1,
	durationMs: 1_000,
	...overrides,
});

/** The run's rows as [id, status, attempts] triples — the whole table, minus the clock. */
const shapeOf = ({ rows }: { rows: { id: string; status: RunStatus | undefined; attempts: number }[] }) =>
	rows.map((row) => [row.id, row.status, row.attempts]);

describe('getRunProgress', () => {
	test('a run nobody asked to ship gets no ship row and is never awaiting one', async () => {
		const { cwd, manifest } = setupProgress({ manifest: manifestOf({ status: RunStatus.Passed, steps: [stepOf()] }) });

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(progress.rows.map((row) => row.id)).toStrictEqual(['implement']);
		expect(progress.awaitingShip).toBe(false);
	});

	test('a run that will ship shows ship as its last row, pending until a result is filed', async () => {
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({ status: RunStatus.Passed, willShip: true, branch: 'lo-52-status', steps: [stepOf()] }),
		});

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(shapeOf({ rows: progress.rows })).toStrictEqual([
			['implement', RunStatus.Passed, 1],
			['ship', undefined, 0],
		]);
		// the ship happens after the pipeline returns, so a terminal run can still
		// have a story left to tell
		expect(progress.awaitingShip).toBe(true);
	});

	test.each([
		{ label: 'a shipped branch', status: ShipStatus.Shipped, expected: RunStatus.Passed },
		{ label: 'a blocked one', status: ShipStatus.Blocked, expected: RunStatus.Failed },
	])('the ship row reads $label from the branch’s own result', async ({ status, expected }) => {
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({ status: RunStatus.Passed, willShip: true, branch: 'lo-52-status', steps: [stepOf()] }),
			shipResult: { branch: 'lo-52-status', status },
		});

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(progress.rows.at(-1)).toStrictEqual({
			id: 'ship',
			status: expected,
			attempts: 1,
			durationMs: undefined,
			verification: undefined,
			cleanup: undefined,
		});
		expect(progress.awaitingShip).toBe(false);
	});

	test('a run that recorded no branch cannot find its own result, so the ship row stays pending', async () => {
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({ status: RunStatus.Passed, willShip: true, steps: [stepOf()] }),
			shipResult: { branch: 'lo-52-status', status: ShipStatus.Shipped },
		});

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(progress.rows.at(-1)).toStrictEqual({
			id: 'ship',
			status: undefined,
			attempts: 0,
			durationMs: undefined,
			verification: undefined,
			cleanup: undefined,
		});
	});

	test.each([
		{ label: 'failed', status: RunStatus.Failed },
		{ label: 'escalated', status: RunStatus.Escalated },
	])('a run that ended $label gets no ship row — that ship will never happen', async ({ status }) => {
		const { cwd, manifest } = setupProgress({ manifest: manifestOf({ status, willShip: true, branch: 'lo-52-status', steps: [stepOf()] }) });

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(progress.rows.map((row) => row.id)).toStrictEqual(['implement']);
		expect(progress.awaitingShip).toBe(false);
	});

	test('a paused run keeps its ship row, because a resume can still finish and ship it', async () => {
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({ status: RunStatus.PausedRateLimit, willShip: true, branch: 'lo-52-status', steps: [stepOf()] }),
		});

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(progress.rows.map((row) => row.id)).toStrictEqual(['implement', 'ship']);
	});
});
