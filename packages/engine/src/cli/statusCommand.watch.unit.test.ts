import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { statusCommand } from '#src/cli/statusCommand.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';

/**
 * The one branch of `--watch` a test can drive end to end without a clock: a run
 * that has already stopped. The repaint loop paints its frame, reads a terminal
 * status, and ends — so nothing here is stubbed, and the watch itself runs.
 *
 * The going-run cases belong to `watchRunProgress`'s own test, which drives the
 * two-minute cadence and the phase handoff directly; the sibling status tests
 * stub the watch for the same reason.
 */
const manifestOf = ({ runId, ...overrides }: { runId: string } & Partial<RunManifest>): RunManifest => ({
	runId,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:01:00.000Z',
	plan: 'plans/demo/plan.md',
	harness: 'claude-code',
	status: RunStatus.Failed,
	currentStep: null,
	steps: [{ id: 'implement', status: RunStatus.Failed, attempts: 1, durationMs: 60_000 }],
	changedFiles: [],
	commits: [],
	packages: [],
	baselineDirtyFiles: [],
	testSubjects: [],
	acceptanceTests: [],
	approvedTests: [],
	unreachableChangedFiles: [],
	coverageExcludedChangedFiles: [],
	...overrides,
});

/** A pid no process holds, so an owner record naming it names an engine that is gone. */
const deadPid = 999_999_999;

/**
 * A temp checkout holding one run, optionally with a ship result already filed
 * for its branch, and optionally with an owner record naming a given pid.
 */
const setupWatch = ({ manifest, shipped = false, ownerPid }: { manifest: RunManifest; shipped?: boolean; ownerPid?: number }) => {
	const captured = captureCommandOutput();
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-status-watch-'));

	mkdirSync(runDirFor({ cwd, runId: manifest.runId }), { recursive: true });
	writeFileSync(join(runDirFor({ cwd, runId: manifest.runId }), 'manifest.json'), JSON.stringify(manifest), 'utf8');

	if (ownerPid !== undefined) {
		writeFileSync(
			join(runDirFor({ cwd, runId: manifest.runId }), 'owner.json'),
			JSON.stringify({ pid: ownerPid, recordedAt: '2026-01-01T00:00:00.000Z' }),
			'utf8',
		);
	}

	if (shipped && manifest.branch !== undefined) {
		// A ship result is filed with the work order whose record stores the branch,
		// so the record is what makes the result findable at all.
		seedWorkOrderRecord({ cwd, name: manifest.branch });
		mkdirSync(join(cwd, '.lightsout', 'work-orders', manifest.branch), { recursive: true });
		writeFileSync(
			join(cwd, '.lightsout', 'work-orders', manifest.branch, 'ship.json'),
			JSON.stringify({ status: ShipStatus.Shipped, branch: manifest.branch, failingChecks: [] }),
			'utf8',
		);
	}

	return {
		context: {
			flags: new Map<string, string | true>([
				['run', manifest.runId],
				['watch', true],
			]),
			rest: [],
			cwd,
		},
		...captured,
	};
};

/** A finished phased plan's coordinator, by full id — its first eight characters end its block's title line. */
const coordinatorRunId = 'c0000001-0000-4000-8000-000000000000';

/** The first phase the coordinator ran. */
const firstPhaseRunId = 'p0000002-0000-4000-8000-000000000000';

/** The last phase the coordinator ran — the one a watch is asked to follow. */
const lastPhaseRunId = 'p0000003-0000-4000-8000-000000000000';

/** Writes a manifest where a real run of its pipeline would keep it. */
const seedManifest = ({ cwd, manifest }: { cwd: string; manifest: RunManifest }) => {
	const runDir = runDirFor({ cwd, runId: manifest.runId, pipeline: manifest.pipeline });

	mkdirSync(runDir, { recursive: true });
	writeFileSync(join(runDir, 'manifest.json'), JSON.stringify(manifest), 'utf8');
};

/**
 * A temp checkout holding one finished phased family — a passed coordinator and
 * its two passed phases — with the screen `status --now` prints for it already
 * captured, and fresh capture arrays for the watch that follows. Nothing in the
 * family is going and nothing awaits a ship, so the watch paints one frame.
 */
const setupFinishedPhasedFamily = async () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-status-watch-'));

	seedManifest({
		cwd,
		manifest: manifestOf({
			runId: coordinatorRunId,
			pipeline: PipelineKind.Phases,
			status: RunStatus.Passed,
			createdAt: '2026-09-10T09:00:00.000Z',
			updatedAt: '2026-09-10T09:30:00.000Z',
			steps: [
				{ id: 'phase-1', status: RunStatus.Passed, attempts: 1, durationMs: 600_000, report: { runId: firstPhaseRunId } },
				{ id: 'phase-2', status: RunStatus.Passed, attempts: 1, durationMs: 900_000, report: { runId: lastPhaseRunId } },
			],
		}),
	});
	seedManifest({
		cwd,
		manifest: manifestOf({
			runId: firstPhaseRunId,
			parentRunId: coordinatorRunId,
			plan: 'plans/demo/phase-1.md',
			status: RunStatus.Passed,
			createdAt: '2026-09-10T09:01:00.000Z',
			updatedAt: '2026-09-10T09:11:00.000Z',
			steps: [{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 600_000 }],
		}),
	});
	seedManifest({
		cwd,
		manifest: manifestOf({
			runId: lastPhaseRunId,
			parentRunId: coordinatorRunId,
			plan: 'plans/demo/phase-2.md',
			status: RunStatus.Passed,
			createdAt: '2026-09-10T09:12:00.000Z',
			updatedAt: '2026-09-10T09:27:00.000Z',
			steps: [{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 900_000 }],
		}),
	});

	// The screen to match, read from the --now form itself rather than restated,
	// because the claim is that the two forms print one screen.
	const now = captureCommandOutput();

	await statusCommand({ flags: new Map<string, string | true>([['now', true]]), rest: [], cwd }).catch((error: unknown) => {
		if (!(error instanceof Error && error.message === 'process.exit')) {
			throw error;
		}
	});

	const nowScreen = [...now.logged];

	return {
		context: {
			flags: new Map<string, string | true>([
				['run', lastPhaseRunId],
				['watch', true],
			]),
			rest: [],
			cwd,
		},
		nowScreen,
		...captureCommandOutput(),
	};
};

describe('statusCommand --run --watch', () => {
	test('a watch frame is byte for byte the screen --now prints for the same family', async () => {
		const { context, nowScreen, logged, errors, exitCodes } = await setupFinishedPhasedFamily();

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toStrictEqual(nowScreen);
		// the family screen, not one run's block: the coordinator, then the phase
		expect(logged.some((line) => line.endsWith('c0000001'))).toBe(true);
		expect(logged.some((line) => line.endsWith('p0000003'))).toBe(true);
		// the leading blank line and the one between the two blocks: one frame, no repaint
		expect(logged.filter((line) => line === '')).toStrictEqual(['', '']);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('a run that has already stopped is painted once and the watch ends there', async () => {
		const { context, logged, errors, exitCodes } = setupWatch({ manifest: manifestOf({ runId: 'run-over' }) });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		// one leading blank line means one frame: a repaint would append a second
		expect(logged.filter((line) => line === '')).toStrictEqual(['']);
		expect(logged.some((line) => /^ ✗ {2}implement +failed +1m 00s$/.test(line))).toBe(true);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('a run still marked running whose owner is gone is painted once, drawn stopped, and the watch ends there', async () => {
		const { context, logged, errors, exitCodes } = setupWatch({
			manifest: manifestOf({
				runId: 'run-crashed',
				status: RunStatus.Running,
				currentStep: 'implement',
				steps: [{ id: 'implement', status: RunStatus.Running, attempts: 1, durationMs: 60_000 }],
			}),
			ownerPid: deadPid,
		});

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		// one leading blank line means one frame: a dead engine is never waited on
		expect(logged.filter((line) => line === '')).toStrictEqual(['']);
		expect(logged.some((line) => /^ ■ {2}implement +stopped +1m 00s$/.test(line))).toBe(true);
		expect(logged.some((line) => /^ ▶/.test(line))).toBe(false);
		expect(logged.some((line) => /no live process.*lightsout resume --run run-crashed/.test(line))).toBe(true);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('a passed run whose ship result is already filed paints that outcome and does not wait for one', async () => {
		const { context, logged, exitCodes } = setupWatch({
			manifest: manifestOf({
				runId: 'run-shipped',
				status: RunStatus.Passed,
				willShip: true,
				branch: 'lo-9-demo',
				steps: [{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 60_000 }],
			}),
			shipped: true,
		});

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged.some((line) => /^ ✓ {2}ship +passed +—$/.test(line))).toBe(true);
		// the settle exists for a ship still in flight; a filed result skips it, so
		// there is no second frame
		expect(logged.filter((line) => line === '')).toStrictEqual(['']);
		expect(exitCodes).toStrictEqual([0]);
	});
});
