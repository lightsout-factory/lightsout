import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { watchRunProgress } from '#src/cli/internal/common/utils/watchRunProgress.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';

/** Beyond any OS pid range — the live-process probe reports it dead. */
const deadPid = 999_999_999;

/** Short enough that a whole watch finishes inside one test, long enough that nothing races. */
const timings = { intervalMs: 20, shipPollMs: 10, shipCeilingMs: 120 };

const manifestOf = ({ runId, ...overrides }: { runId: string } & Partial<RunManifest>): RunManifest => ({
	runId,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:10:00.000Z',
	plan: 'plans/demo/plan.md',
	harness: 'claude-code',
	status: RunStatus.Running,
	currentStep: null,
	steps: [{ id: 'implement', status: RunStatus.Running, attempts: 1, durationMs: 1_000 }],
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

const stepOf = (overrides: Partial<StepRecord> = {}): StepRecord => ({
	id: 'implement',
	status: RunStatus.Running,
	attempts: 1,
	durationMs: 1_000,
	...overrides,
});

/**
 * A repo whose run state can be rewritten BETWEEN frames.
 *
 * Every frame opens with a blank line, so counting those counts frames — and
 * the count is what drives each rewrite. Driving the state off frames rather
 * than off the clock is what keeps a watch test from turning on how fast the
 * machine is.
 */
const setupWatch = ({ onFrame }: { onFrame?: (frame: number) => void } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-watch-'));
	const lines: string[] = [];
	let frames = 0;

	process.stdout.isTTY = false;
	mkdirSync(join(cwd, '.lightsout', 'runs'), { recursive: true });

	jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
		const line = String(args[0]);

		lines.push(line);

		if (line === '') {
			frames += 1;
			onFrame?.(frames);
		}
	});

	const write = ({ manifest }: { manifest: RunManifest }) => {
		mkdirSync(runDirFor({ cwd, runId: manifest.runId }), { recursive: true });
		writeFileSync(join(runDirFor({ cwd, runId: manifest.runId }), 'manifest.json'), JSON.stringify(manifest), 'utf8');
	};
	const lock = ({ runId, pid }: { runId: string; pid: number }) =>
		writeFileSync(join(cwd, '.lightsout', 'lock.json'), JSON.stringify({ pid, runId, startedAt: '2026-01-01T00:00:00.000Z' }), 'utf8');
	const shipResult = ({ branch, status }: { branch: string; status: ShipStatus }) => {
		// The ship result is filed in the work order whose record stores the branch.
		seedWorkOrderRecord({ cwd, name: branch });
		writeFileSync(join(cwd, '.lightsout', 'work-orders', branch, 'ship.json'), JSON.stringify({ status, branch, failingChecks: [] }), 'utf8');
	};

	return { cwd, lines, write, lock, shipResult, frameCount: () => frames };
};

/** Each frame as its own block of lines, split on the blank line every frame opens with. */
const framesOf = ({ lines }: { lines: string[] }) => {
	const blocks: string[][] = [];

	for (const line of lines) {
		if (line === '' || blocks.length === 0) {
			blocks.push([]);
		}

		if (line !== '') {
			blocks.at(-1)?.push(line);
		}
	}

	return blocks;
};

/** The cadence a family watch runs at — the follow-mode handoff wait is gone, so it takes none. */
const familyTimings = { intervalMs: 20, shipPollMs: 10, shipCeilingMs: 120 };

/** Makes `pid` the run's owner — the process the run's liveness answers to. No start time, so the pid alone decides. */
const writeOwner = ({ cwd, runId, pid }: { cwd: string; runId: string; pid: number }) =>
	writeFileSync(join(runDirFor({ cwd, runId }), 'owner.json'), JSON.stringify({ pid, recordedAt: '2026-01-01T00:00:00.000Z' }), 'utf8');

/**
 * A repo whose run family can be rewritten BETWEEN family screens.
 *
 * A family screen holds a blank line between its coordinator and phase blocks,
 * so blank lines no longer count frames — the root's title line, which ends in
 * its short id and opens every screen of the family, does. The whole screen is
 * loaded before its first line prints, so a rewrite made on the title line
 * lands in the next frame.
 */
const setupFamilyWatch = ({ rootTag, onFrame }: { rootTag: string; onFrame?: (frame: number) => void }) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-watch-family-'));
	const lines: string[] = [];
	let frames = 0;

	process.stdout.isTTY = false;

	jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
		const line = String(args[0]);

		lines.push(line);

		if (line.endsWith(rootTag)) {
			frames += 1;
			onFrame?.(frames);
		}
	});

	const write = ({ manifest }: { manifest: RunManifest }) => {
		mkdirSync(runDirFor({ cwd, runId: manifest.runId }), { recursive: true });
		writeFileSync(join(runDirFor({ cwd, runId: manifest.runId }), 'manifest.json'), JSON.stringify(manifest), 'utf8');
	};
	const shipResult = ({ branch, status }: { branch: string; status: ShipStatus }) => {
		seedWorkOrderRecord({ cwd, name: branch });
		writeFileSync(join(cwd, '.lightsout', 'work-orders', branch, 'ship.json'), JSON.stringify({ status, branch, failingChecks: [] }), 'utf8');
	};
	/** Each frame as its own lines, split on the root's title line every family screen opens with. */
	const frameLines = () => {
		const blocks: string[][] = [];

		for (const line of lines) {
			if (line.endsWith(rootTag)) {
				blocks.push([]);
			}

			if (line !== '') {
				blocks.at(-1)?.push(line);
			}
		}

		return blocks;
	};

	return { cwd, write, shipResult, frameLines };
};

/** The short ids whose block title lines a frame holds, in order — which runs the frame painted. */
const blockTagsOf = ({ frame, tags }: { frame: string[]; tags: string[] }) => frame.flatMap((line) => tags.filter((tag) => line.endsWith(tag)));

const familyRootId = 'coordrun-family';
const firstPhaseId = 'phase001-child';
const secondPhaseId = 'phase002-child';
const familyTags = ['coordrun', 'phase001', 'phase002'];

const coordinatorOf = ({ status = RunStatus.Running, steps, updatedAt, ...overrides }: Partial<RunManifest> & { steps: StepRecord[]; updatedAt: string }) =>
	manifestOf({ runId: familyRootId, pipeline: 'phases', plan: 'plans/demo/overview.md', status, steps, updatedAt, ...overrides });

const phaseChildOf = ({ runId, plan, status, updatedAt }: { runId: string; plan: string; status: RunStatus; updatedAt: string }) =>
	manifestOf({ runId, parentRunId: familyRootId, plan, status, updatedAt, steps: [stepOf({ status })] });

describe('watchRunProgress', () => {
	test('a run that has already finished paints exactly one frame', async () => {
		const watch = setupWatch();

		watch.write({ manifest: manifestOf({ runId: 'run-done', status: RunStatus.Passed, steps: [stepOf({ status: RunStatus.Passed })] }) });

		await watchRunProgress({ cwd: watch.cwd, runId: 'run-done', ...timings });

		expect(watch.frameCount()).toBe(1);
	});

	test('a run that finishes after two frames paints three, and the last one shows the end state', async () => {
		const watch = setupWatch({
			onFrame: (frame) => {
				if (frame === 2) {
					watch.write({ manifest: manifestOf({ runId: 'run-live', status: RunStatus.Passed, steps: [stepOf({ status: RunStatus.Passed })] }) });
				}
			},
		});

		watch.write({ manifest: manifestOf({ runId: 'run-live' }) });
		watch.lock({ runId: 'run-live', pid: process.pid });

		await watchRunProgress({ cwd: watch.cwd, runId: 'run-live', ...timings });

		const blocks = framesOf({ lines: watch.lines });

		expect(blocks).toHaveLength(3);
		// the frame a reader keeps is the one that says how the run ended
		expect(blocks.at(-1)?.some((line) => line.includes('passed'))).toBe(true);
	});

	test.each([
		{ label: 'a rate-limit pause', status: RunStatus.PausedRateLimit },
		{ label: 'a budget pause', status: RunStatus.PausedBudget },
		{ label: 'an escalation', status: RunStatus.Escalated },
	])('$label is a last frame — the run is stopped, whatever it is called', async ({ status }) => {
		const watch = setupWatch();

		watch.write({ manifest: manifestOf({ runId: 'run-parked', status }) });
		watch.lock({ runId: 'run-parked', pid: process.pid });

		await watchRunProgress({ cwd: watch.cwd, runId: 'run-parked', ...timings });

		expect(watch.frameCount()).toBe(1);
	});

	test('a ship result that lands mid-settle earns exactly one more frame, showing the row filled', async () => {
		const watch = setupWatch({
			onFrame: (frame) => {
				if (frame === 1) {
					watch.shipResult({ branch: 'lo-52-status', status: ShipStatus.Shipped });
				}
			},
		});

		watch.write({
			manifest: manifestOf({
				runId: 'run-shipping',
				status: RunStatus.Passed,
				willShip: true,
				branch: 'lo-52-status',
				steps: [stepOf({ status: RunStatus.Passed })],
			}),
		});

		await watchRunProgress({ cwd: watch.cwd, runId: 'run-shipping', ...timings });

		const blocks = framesOf({ lines: watch.lines });

		// shipping happens after the pipeline returns, so the run's own last frame
		// cannot be the whole story
		expect(blocks).toHaveLength(2);
		expect(blocks[0]?.some((line) => line.startsWith(' ·  ship'))).toBe(true);
		expect(blocks[1]?.some((line) => line.includes('ship') && line.includes('passed'))).toBe(true);
	});

	test('a ship result that never lands still earns exactly one more frame once the ceiling passes', async () => {
		const watch = setupWatch();

		watch.write({
			manifest: manifestOf({
				runId: 'run-waiting',
				status: RunStatus.Passed,
				willShip: true,
				branch: 'lo-52-status',
				steps: [stepOf({ status: RunStatus.Passed })],
			}),
		});

		await watchRunProgress({ cwd: watch.cwd, runId: 'run-waiting', ...timings });

		// one quiet wait and one final frame, never fifteen near-identical blocks
		expect(watch.frameCount()).toBe(2);
	});

	test('a run that will not ship gets no settle and no extra frame', async () => {
		const watch = setupWatch();

		watch.write({ manifest: manifestOf({ runId: 'run-plain', status: RunStatus.Passed, steps: [stepOf({ status: RunStatus.Passed })] }) });

		await watchRunProgress({ cwd: watch.cwd, runId: 'run-plain', ...timings });

		expect(watch.frameCount()).toBe(1);
	});

	test('every frame paints the family screen and the watch follows the root across phases', async () => {
		const watch = setupFamilyWatch({
			rootTag: 'coordrun',
			onFrame: (frame) => {
				if (frame === 1) {
					// the first phase ends; the coordinator names the next child before it exists
					watch.write({
						manifest: phaseChildOf({ runId: firstPhaseId, plan: 'plans/demo/phase1.md', status: RunStatus.Passed, updatedAt: '2026-01-01T00:20:00.000Z' }),
					});
					watch.write({
						manifest: coordinatorOf({
							updatedAt: '2026-01-01T00:21:00.000Z',
							steps: [
								{ id: 'phase1.md', status: RunStatus.Passed, attempts: 1, durationMs: 60_000, report: { runId: firstPhaseId } },
								{ id: 'phase2.md', status: RunStatus.Running, attempts: 1, report: { runId: secondPhaseId } },
							],
						}),
					});
				}

				if (frame === 2) {
					watch.write({
						manifest: phaseChildOf({ runId: secondPhaseId, plan: 'plans/demo/phase2.md', status: RunStatus.Running, updatedAt: '2026-01-01T00:25:00.000Z' }),
					});
				}

				if (frame === 3) {
					watch.write({
						manifest: phaseChildOf({ runId: secondPhaseId, plan: 'plans/demo/phase2.md', status: RunStatus.Passed, updatedAt: '2026-01-01T00:40:00.000Z' }),
					});
					watch.write({
						manifest: coordinatorOf({
							status: RunStatus.Passed,
							updatedAt: '2026-01-01T00:41:00.000Z',
							steps: [
								{ id: 'phase1.md', status: RunStatus.Passed, attempts: 1, durationMs: 60_000, report: { runId: firstPhaseId } },
								{ id: 'phase2.md', status: RunStatus.Passed, attempts: 1, durationMs: 60_000, report: { runId: secondPhaseId } },
							],
						}),
					});
				}
			},
		});

		watch.write({
			manifest: coordinatorOf({
				updatedAt: '2026-01-01T00:10:00.000Z',
				steps: [
					{ id: 'phase1.md', status: RunStatus.Running, attempts: 1, report: { runId: firstPhaseId } },
					{ id: 'phase2.md', status: RunStatus.Pending, attempts: 0 },
				],
			}),
		});
		watch.write({
			manifest: phaseChildOf({ runId: firstPhaseId, plan: 'plans/demo/phase1.md', status: RunStatus.Running, updatedAt: '2026-01-01T00:15:00.000Z' }),
		});
		// the coordinator's owner is the one process behind the family, and no lock is held anywhere
		writeOwner({ cwd: watch.cwd, runId: familyRootId, pid: process.pid });

		await watchRunProgress({ cwd: watch.cwd, runId: firstPhaseId, ...familyTimings });

		const paintedRuns = watch.frameLines().map((frame) => blockTagsOf({ frame, tags: familyTags }));

		// the moving phase, the boundary with the next phase not yet started, the
		// next phase, and the frame in which the coordinator has passed — then nothing
		expect(paintedRuns).toStrictEqual([['coordrun', 'phase001'], ['coordrun'], ['coordrun', 'phase002'], ['coordrun', 'phase002']]);
	});

	test('a stopped run ends the watch after its first frame', async () => {
		const watch = setupWatch();

		watch.write({ manifest: manifestOf({ runId: 'stopped-run' }) });
		writeOwner({ cwd: watch.cwd, runId: 'stopped-run', pid: deadPid });

		await watchRunProgress({ cwd: watch.cwd, runId: 'stopped-run', ...familyTimings });

		const blocks = framesOf({ lines: watch.lines });

		// no dead-frame tolerance: an owner that is gone is a stopped run, not a phase boundary
		expect({
			frames: blocks.length,
			stoppedRow: blocks[0]?.some((line) => /■\s+implement\s+stopped/.test(line)),
			resumeHint: blocks[0]?.some((line) => line.includes('lightsout resume --run stopped-run')),
		}).toStrictEqual({ frames: 1, stoppedRow: true, resumeHint: true });
	});

	test("the ship settle's last frame is the family screen too", async () => {
		const watch = setupFamilyWatch({
			rootTag: 'coordrun',
			onFrame: (frame) => {
				if (frame === 1) {
					watch.shipResult({ branch: 'lo-185-watch', status: ShipStatus.Shipped });
				}
			},
		});

		watch.write({
			manifest: coordinatorOf({
				status: RunStatus.Passed,
				willShip: true,
				branch: 'lo-185-watch',
				updatedAt: '2026-01-01T00:30:00.000Z',
				steps: [{ id: 'phase1.md', status: RunStatus.Passed, attempts: 1, durationMs: 60_000, report: { runId: firstPhaseId } }],
			}),
		});
		watch.write({
			manifest: phaseChildOf({ runId: firstPhaseId, plan: 'plans/demo/phase1.md', status: RunStatus.Passed, updatedAt: '2026-01-01T00:25:00.000Z' }),
		});

		await watchRunProgress({ cwd: watch.cwd, runId: familyRootId, ...familyTimings });

		const frames = watch.frameLines();

		expect({
			paintedRuns: frames.map((frame) => blockTagsOf({ frame, tags: familyTags })),
			shipPendingFirst: frames[0]?.some((line) => line.startsWith(' ·  ship')),
			shipPassedLast: frames[1]?.some((line) => line.includes('ship') && line.includes('passed')),
		}).toStrictEqual({
			paintedRuns: [
				['coordrun', 'phase001'],
				['coordrun', 'phase001'],
			],
			shipPendingFirst: true,
			shipPassedLast: true,
		});
	});
});
