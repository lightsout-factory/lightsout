import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, test } from '@jest/globals';
import { resolveQueueRun } from '#src/cli/internal/common/queueBoard/resolveQueueRun.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

/** Beyond any OS pid range — the live-process probe reports it dead. */
const deadPid = 999_999_999;

type PlantedRun = Partial<RunManifest> & { runId: string };

/** A main checkout whose runs directory holds exactly the planted manifests, and whose run lock is written on demand. */
const setupCheckout = async () => {
	const cwd = await freshCwd();

	const plant = async ({ runId, ...overrides }: PlantedRun) => {
		await seedRunDir({ cwd, manifest: { runId, ...overrides } });
	};

	/** The main checkout's run lock — the file the queue's live process is recognised by. */
	const lock = async ({ runId, pid }: { runId: string; pid: number }) => {
		await mkdir(join(cwd, '.lightsout'), { recursive: true });
		await writeFile(join(cwd, '.lightsout', 'lock.json'), JSON.stringify({ pid, runId, startedAt: '2026-01-01T00:00:00.000Z' }), 'utf8');
	};

	/** A live queue run that writes its manifest, then takes the lock, only after the given delay — as a just-launched queue does. */
	const startQueueLater = async ({ runId, afterMs }: { runId: string; afterMs: number }) => {
		await delay(afterMs);
		await plant({ runId, pipeline: PipelineKind.Queue, status: RunStatus.Running });
		await lock({ runId, pid: process.pid });
	};

	return { cwd, plant, lock, startQueueLater };
};

/**
 * Two main checkouts, neither holding a run lock: in one the only queue run's
 * owner record names this test process, in the other it names a dead pid.
 */
const setupOwnedQueueRuns = async () => {
	const liveCwd = await freshCwd();
	const deadCwd = await freshCwd();

	await seedRunDir({ cwd: liveCwd, manifest: { runId: 'queue-owned', pipeline: PipelineKind.Queue, status: RunStatus.Running } });
	await writeRunOwner({ cwd: liveCwd, runId: 'queue-owned' });

	const deadRunDir = await seedRunDir({ cwd: deadCwd, manifest: { runId: 'queue-orphaned', pipeline: PipelineKind.Queue, status: RunStatus.Running } });
	await writeFile(join(deadRunDir, 'owner.json'), JSON.stringify({ pid: deadPid, recordedAt: '2026-01-01T00:00:00.000Z' }), 'utf8');

	return { liveCwd, deadCwd };
};

describe('resolveQueueRun', () => {
	test('the unnamed queue run is the one a live owner stands behind', async () => {
		const { liveCwd, deadCwd } = await setupOwnedQueueRuns();

		const ownedListing = await resolveQueueRun({ cwd: liveCwd, graceMs: 0 });
		const orphanedListing = await resolveQueueRun({ cwd: deadCwd, graceMs: 0 });

		expect({ ownedListing, orphanedListing }).toEqual({
			ownedListing: expect.objectContaining({ runId: 'queue-owned', pipeline: 'queue', live: true }),
			orphanedListing: undefined,
		});
	});

	test("follows the queue run the main checkout's run lock names while its process is alive", async () => {
		const { cwd, plant, lock } = await setupCheckout();

		await plant({ runId: 'queue-live', pipeline: PipelineKind.Queue, status: RunStatus.Running });
		await lock({ runId: 'queue-live', pid: process.pid });

		const listing = await resolveQueueRun({ cwd, graceMs: 0 });

		expect(listing).toEqual(expect.objectContaining({ runId: 'queue-live', pipeline: 'queue', live: true }));
	});

	test('ignores a live lock held by a run that is not a queue run', async () => {
		const { cwd, plant, lock } = await setupCheckout();

		await plant({ runId: 'implement-live', pipeline: PipelineKind.Implement, status: RunStatus.Running });
		await lock({ runId: 'implement-live', pid: process.pid });

		const listing = await resolveQueueRun({ cwd, graceMs: 0 });

		expect(listing).toBeUndefined();
	});

	test("answers with nothing when the lock's process is gone, rather than the newest queue run", async () => {
		const { cwd, plant, lock } = await setupCheckout();

		await plant({
			runId: 'queue-crashed',
			pipeline: PipelineKind.Queue,
			status: RunStatus.Running,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:01:00.000Z',
		});
		await plant({
			runId: 'queue-newer',
			pipeline: PipelineKind.Queue,
			status: RunStatus.Running,
			createdAt: '2026-01-01T00:05:00.000Z',
			updatedAt: '2026-01-01T00:06:00.000Z',
		});
		await lock({ runId: 'queue-crashed', pid: deadPid });

		const listing = await resolveQueueRun({ cwd, graceMs: 0 });

		expect(listing).toBeUndefined();
	});

	test('without the wait asked for, an absent queue run is answered at once instead of polling out the grace', async () => {
		const { cwd, plant } = await setupCheckout();

		await plant({ runId: 'queue-passed', pipeline: PipelineKind.Queue, status: RunStatus.Passed });

		const started = Date.now();
		const listing = await resolveQueueRun({ cwd, graceMs: 60_000 });
		const elapsedMs = Date.now() - started;

		expect({ listing, waited: elapsedMs >= 1_000 }).toEqual({ listing: undefined, waited: false });
	});

	test('with the wait asked for, a queue run that takes the lock mid-grace is still found', async () => {
		const { cwd, startQueueLater } = await setupCheckout();
		const arrival = startQueueLater({ runId: 'queue-launching', afterMs: 100 });

		const listing = await resolveQueueRun({ cwd, wait: true, graceMs: 2_000, pollMs: 20 });
		await arrival;

		expect(listing).toEqual(expect.objectContaining({ runId: 'queue-launching', live: true }));
	});

	test("returns the named run's listing without waiting when a run id is given", async () => {
		const { cwd, plant } = await setupCheckout();

		await plant({ runId: 'queue-passed', pipeline: PipelineKind.Queue, status: RunStatus.Passed });

		const started = Date.now();
		const listing = await resolveQueueRun({ cwd, runId: 'queue-passed', graceMs: 60_000 });
		const elapsedMs = Date.now() - started;

		expect({ listing, waited: elapsedMs >= 1_000 }).toEqual({
			listing: expect.objectContaining({ runId: 'queue-passed', live: false, status: 'passed' }),
			waited: false,
		});
	});
});
