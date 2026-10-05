import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { watchRunProgress } from '#src/cli/statusCommand/watchRunProgress.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { runningRunManifestOf } from '#tests/helpers/runningRunManifestOf.ts';
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';

const stepOf = (overrides: Partial<StepRecord> = {}): StepRecord => ({
	id: 'implement',
	status: RunStatus.Running,
	attempts: 1,
	durationMs: 1_000,
	...overrides,
});

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
	runningRunManifestOf({ runId: familyRootId, pipeline: 'phases', plan: 'plans/demo/overview.md', status, steps, updatedAt, ...overrides });

const phaseChildOf = ({ runId, plan, status, updatedAt }: { runId: string; plan: string; status: RunStatus; updatedAt: string }) =>
	runningRunManifestOf({ runId, parentRunId: familyRootId, plan, status, updatedAt, steps: [stepOf({ status })] });

describe('watchRunProgress', () => {
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
