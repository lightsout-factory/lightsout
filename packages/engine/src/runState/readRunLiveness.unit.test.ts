import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';
import { readRunLiveness } from '#src/runState/readRunLiveness.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

/** A pid this far out of range belongs to no process, which is what a crashed engine's owner record looks like. */
const deadPid = 2 ** 30;

/**
 * Who answers for a seeded run: this test process, an engine that has gone, a
 * pointer to the queue run whose owner answers for it, or nobody at all.
 */
type SeededOwner = 'self' | 'dead' | { queueRunId: string };

interface SeededRun {
	manifest: Partial<RunManifest> & { runId: string };
	/** Absent means the run recorded no owner. */
	owner?: SeededOwner;
	/** Plant a lock naming this run, held by this test process, in a workspace checkout of its own. */
	liveLock?: boolean;
}

const manifestOf = (overrides: Partial<RunManifest> & { runId: string }): RunManifest => ({
	createdAt: '2026-09-30T09:00:00.000Z',
	updatedAt: '2026-09-30T09:01:00.000Z',
	plan: 'plans/demo/plan.md',
	harness: 'claude-code',
	status: RunStatus.Running,
	currentStep: null,
	steps: [],
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

/**
 * A checkout holding every run the case asks about, each with its manifest,
 * its owner record and its workspace lock written before anything is read.
 * Every case gets its own temporary checkout, because the run lookup remembers
 * what it found for the life of the process.
 *
 * @returns the checkout and each run's full manifest, keyed by run id
 */
const setupCheckout = async ({ runs }: { runs: SeededRun[] }) => {
	const cwd = await freshCwd();
	const manifests: Record<string, RunManifest> = {};
	const runDirs: Record<string, string> = {};

	for (const run of runs) {
		let workspace: string | undefined;

		if (run.liveLock === true) {
			workspace = await mkdtemp(join(tmpdir(), 'lightsout-workspace-'));
			await mkdir(join(workspace, '.lightsout'), { recursive: true });
			await writeFile(
				join(workspace, '.lightsout', 'lock.json'),
				JSON.stringify({ pid: process.pid, runId: run.manifest.runId, startedAt: '2026-09-30T09:00:00.000Z' }),
				'utf8',
			);
		}

		const manifest = manifestOf({ ...run.manifest, ...(workspace === undefined ? {} : { workspace }) });

		manifests[manifest.runId] = manifest;
		runDirs[manifest.runId] = await seedRunDir({ cwd, manifest });
	}

	// owners go in only once every run folder exists, so the first lookup finds them all
	for (const run of runs) {
		const { runId } = run.manifest;

		if (run.owner === 'self') {
			await writeRunOwner({ cwd, runId });
		} else if (run.owner === 'dead') {
			await writeFile(join(runDirs[runId], 'owner.json'), JSON.stringify({ pid: deadPid, recordedAt: '2026-09-30T09:00:00.000Z' }), 'utf8');
		} else if (run.owner !== undefined) {
			await writeRunOwner({ cwd, runId, queueRunId: run.owner.queueRunId });
		}
	}

	return { cwd, manifests };
};

/** A coordinator whose one running phase step names the child it started. */
const coordinatorOf = ({ runId, childRunId }: { runId: string; childRunId: string }): SeededRun['manifest'] => ({
	runId,
	pipeline: PipelineKind.Phases,
	plan: 'plans/demo/overview.md',
	currentStep: 'phase1',
	steps: [{ id: 'phase1', status: RunStatus.Running, attempts: 1, report: { runId: childRunId } }],
});

describe('readRunLiveness', () => {
	test('answers live with the owner pid while the recorded process lives, and not live once it is gone', async () => {
		const { cwd, manifests } = await setupCheckout({
			runs: [
				{ manifest: { runId: 'run-owned-live' }, owner: 'self' },
				{ manifest: { runId: 'run-owned-dead' }, owner: 'dead' },
			],
		});

		const liveness = await Promise.all([
			readRunLiveness({ cwd, manifest: manifests['run-owned-live'] }),
			readRunLiveness({ cwd, manifest: manifests['run-owned-dead'] }),
		]);

		expect(liveness).toEqual([
			{ live: true, pid: process.pid },
			{ live: false, pid: undefined },
		]);
	});

	test("a queue worker run follows its pointer to the queue run's owner", async () => {
		const { cwd, manifests } = await setupCheckout({
			runs: [
				{ manifest: { runId: 'run-queue-live', pipeline: PipelineKind.Queue }, owner: 'self' },
				{ manifest: { runId: 'run-queue-dead', pipeline: PipelineKind.Queue }, owner: 'dead' },
				{ manifest: { runId: 'run-queue-unowned', pipeline: PipelineKind.Queue } },
				{ manifest: { runId: 'run-worker-of-live' }, owner: { queueRunId: 'run-queue-live' } },
				{ manifest: { runId: 'run-worker-of-dead' }, owner: { queueRunId: 'run-queue-dead' } },
				{ manifest: { runId: 'run-worker-of-unowned' }, owner: { queueRunId: 'run-queue-unowned' } },
			],
		});

		const liveness = await Promise.all([
			readRunLiveness({ cwd, manifest: manifests['run-worker-of-live'] }),
			readRunLiveness({ cwd, manifest: manifests['run-worker-of-dead'] }),
			readRunLiveness({ cwd, manifest: manifests['run-worker-of-unowned'] }),
		]);

		// the worker lives inside the queue process, so the queue's owner is the pid that answers for it
		expect(liveness).toEqual([
			{ live: true, pid: process.pid },
			{ live: false, pid: undefined },
			{ live: false, pid: undefined },
		]);
	});

	test("a phase child is judged by its coordinator's owner and running step", async () => {
		const { cwd, manifests } = await setupCheckout({
			runs: [
				{ manifest: coordinatorOf({ runId: 'run-coordinator', childRunId: 'run-moving-child' }), owner: 'self' },
				{ manifest: { runId: 'run-moving-child', parentRunId: 'run-coordinator' } },
				{ manifest: coordinatorOf({ runId: 'run-other-coordinator', childRunId: 'run-newer-child' }), owner: 'self' },
				{ manifest: { runId: 'run-orphaned-child', parentRunId: 'run-other-coordinator' } },
			],
		});

		const liveness = await Promise.all([
			readRunLiveness({ cwd, manifest: manifests['run-moving-child'] }),
			readRunLiveness({ cwd, manifest: manifests['run-orphaned-child'] }),
		]);

		// a child its coordinator's running step no longer names is an orphan, however alive the coordinator is
		expect(liveness).toEqual([
			{ live: true, pid: process.pid },
			{ live: false, pid: undefined },
		]);
	});

	test('the lock answers only for a root that recorded no owner', async () => {
		const { cwd, manifests } = await setupCheckout({
			runs: [
				{ manifest: { runId: 'run-unowned-locked' }, liveLock: true },
				{ manifest: { runId: 'run-owned-dead-locked' }, owner: 'dead', liveLock: true },
			],
		});

		const liveness = await Promise.all([
			readRunLiveness({ cwd, manifest: manifests['run-unowned-locked'] }),
			readRunLiveness({ cwd, manifest: manifests['run-owned-dead-locked'] }),
		]);

		// an owner record outranks the lock: once a root records one, a live lock naming it proves nothing
		expect(liveness).toEqual([
			{ live: true, pid: process.pid },
			{ live: false, pid: undefined },
		]);
	});

	test('a coordinator naming a child not yet started is judged by its own owner', async () => {
		const { cwd, manifests } = await setupCheckout({
			runs: [{ manifest: coordinatorOf({ runId: 'run-coordinator', childRunId: 'run-child-not-started' }), owner: 'self' }],
		});

		const liveness = await readRunLiveness({ cwd, manifest: manifests['run-coordinator'] });

		expect(liveness).toEqual({ live: true, pid: process.pid });
	});

	test('a pending run is judged by its owner like a running one', async () => {
		const { cwd, manifests } = await setupCheckout({
			runs: [{ manifest: { runId: 'run-pending', status: RunStatus.Pending }, owner: 'self' }],
		});

		const liveness = await readRunLiveness({ cwd, manifest: manifests['run-pending'] });

		expect(liveness).toEqual({ live: true, pid: process.pid });
	});

	test('a pointer that leads to no process-form owner leaves the worker with nobody behind it', async () => {
		const { cwd, manifests } = await setupCheckout({
			runs: [
				{ manifest: { runId: 'run-queue-live', pipeline: PipelineKind.Queue }, owner: 'self' },
				{ manifest: { runId: 'run-queue-pointing-on', pipeline: PipelineKind.Queue }, owner: { queueRunId: 'run-queue-live' } },
				{ manifest: { runId: 'run-worker-of-pointer' }, owner: { queueRunId: 'run-queue-pointing-on' } },
				{ manifest: { runId: 'run-worker-of-missing' }, owner: { queueRunId: 'run-queue-never-recorded' } },
			],
		});

		const liveness = await Promise.all([
			readRunLiveness({ cwd, manifest: manifests['run-worker-of-pointer'] }),
			readRunLiveness({ cwd, manifest: manifests['run-worker-of-missing'] }),
		]);

		// a second pointer is never followed, and a queue run with no folder holds no owner at all
		expect(liveness).toEqual([
			{ live: false, pid: undefined },
			{ live: false, pid: undefined },
		]);
	});

	test('a phase child whose coordinator cannot be found is judged by the lock held under its own id', async () => {
		const { cwd, manifests } = await setupCheckout({
			runs: [
				{ manifest: { runId: 'run-stranded-locked', parentRunId: 'run-coordinator-gone' }, liveLock: true },
				{ manifest: { runId: 'run-stranded-unlocked', parentRunId: 'run-coordinator-gone' } },
			],
		});

		const liveness = await Promise.all([
			readRunLiveness({ cwd, manifest: manifests['run-stranded-locked'] }),
			readRunLiveness({ cwd, manifest: manifests['run-stranded-unlocked'] }),
		]);

		// with no coordinator folder there is no owner record to read, so only the lock can answer — and it names the holder
		expect(liveness).toEqual([
			{ live: true, pid: process.pid },
			{ live: false, pid: undefined },
		]);
	});

	test('a finished run reads not live without consulting its owner', async () => {
		const { cwd, manifests } = await setupCheckout({
			runs: [{ manifest: { runId: 'run-passed', status: RunStatus.Passed }, owner: 'self' }],
		});

		const liveness = await readRunLiveness({ cwd, manifest: manifests['run-passed'] });

		expect(liveness).toEqual({ live: false, pid: undefined });
	});
});
