import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import { PhaseReport } from '#src/contracts/run/PhaseReport.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { runPhasesPipeline } from '#src/phases/runPhasesPipeline.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { writeRunManifest } from '#src/runState/writeRunManifest.ts';
import { createPhaseDriver } from '#tests/helpers/createPhaseDriver.ts';
import { readPhaseChildRuns } from '#tests/helpers/readPhaseChildRuns.ts';
import { setupCommittablePhasedRepo } from '#tests/helpers/setupCommittablePhasedRepo.ts';
import { setupPhasedRepo } from '#tests/helpers/setupPhasedRepo.ts';

/** Permission bits do not apply to root, so the fs failure they provoke is unreachable there. */
const skipAsRoot = process.getuid?.() === 0;
// Jest has no per-call `{ skip }` option, so the choice is made at the call site.
const testUnlessRoot = skipAsRoot ? test.skip : test;

// A directory made read-only mid-test must be writable again, or the temp tree
// cannot be removed. Recorded at file scope so one hook restores it.
let lockedStateDir: string | undefined;

afterEach(() => {
	if (lockedStateDir) {
		chmodSync(lockedStateDir, 0o755);
		lockedStateDir = undefined;
	}
});

test('runPhasesPipeline: resume skips the passed phases and continues the interrupted phase in its own run', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const config = await readConfig({ cwd: dir });
	const parked = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [], parkAt: 2 }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});

	expect(parked.manifest.status).toBe('paused-rate-limit');

	const parkedChild = PhaseReport.parse(parked.manifest.steps[1]?.report).runId;
	const seen: number[] = [];
	const resumed = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen }),
		config,
		loadedConfig: { config },
		existing: await readRunManifest({ cwd: dir, runId: parked.manifest.runId }),
		skipRefactor: true,
	});

	expect(resumed.ok).toBe(true);
	// the passed phase is not re-bought; the interrupted one continues
	expect(seen).toStrictEqual([2]);
	expect(resumed.manifest.status).toBe('passed');
	expect(resumed.manifest.runId).toBe(parked.manifest.runId);
	// the interrupted phase resumed its own run rather than starting a second one
	expect(PhaseReport.parse(resumed.manifest.steps[1]?.report).runId).toBe(parkedChild);
	expect(resumed.manifest.steps[1]?.attempts).toBe(2);
});

test('runPhasesPipeline: a phase whose own run already passed is adopted on resume, never bought twice', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 1 });
	const config = await readConfig({ cwd: dir });
	const passed = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});
	// a crash between the phase finishing and the coordinator recording it: the
	// step still says running, but the run it names is done
	const crashed = await writeRunManifest({
		cwd: dir,
		manifest: {
			...passed.manifest,
			status: RunStatus.Running,
			currentStep: 'phase1.md',
			steps: passed.manifest.steps.map((step) => ({ ...step, status: RunStatus.Running })),
		},
	});
	const seen: number[] = [];

	const resumed = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen }),
		config,
		loadedConfig: { config },
		existing: crashed,
		skipRefactor: true,
	});

	expect(resumed.ok).toBe(true);
	// no agent ran, and the phase's own run id is still the record
	expect(seen).toStrictEqual([]);
	expect(resumed.manifest.status).toBe('passed');
	expect(resumed.manifest.steps[0]?.status).toBe('passed');
	expect(PhaseReport.parse(resumed.manifest.steps[0]?.report).runId).toBe(PhaseReport.parse(passed.manifest.steps[0]?.report).runId);
});

test('runPhasesPipeline: a step naming a run that is gone re-runs the phase in a new run', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 1 });
	const config = await readConfig({ cwd: dir });
	const passed = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});
	const orphaned = await writeRunManifest({
		cwd: dir,
		manifest: {
			...passed.manifest,
			status: RunStatus.Failed,
			steps: passed.manifest.steps.map((step) => ({ ...step, status: RunStatus.Running, report: { runId: 'deleted-child-run' } })),
		},
	});
	const seen: number[] = [];

	const resumed = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen }),
		config,
		loadedConfig: { config },
		existing: orphaned,
		skipRefactor: true,
	});

	expect(resumed.ok).toBe(true);
	// an unreadable child settles nothing, so the phase is implemented again
	expect(seen).toStrictEqual([1]);
	expect(resumed.manifest.steps[0]?.status).toBe('passed');
	expect(PhaseReport.parse(resumed.manifest.steps[0]?.report).runId).not.toBe('deleted-child-run');
});

testUnlessRoot('runPhasesPipeline: a phase that throws for a reason other than the lock is recorded as that phase failing', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 1 });
	const config = await readConfig({ cwd: dir });
	const parked = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [], parkAt: 1 }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});
	const stateDir = join(dir, '.lightsout');

	// the run state directory turns read-only between the park and the resume,
	// so the phase's own run cannot even write its lock file
	chmodSync(stateDir, 0o555);
	lockedStateDir = stateDir;

	const resumed = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		existing: parked.manifest,
		skipRefactor: true,
	});

	expect(resumed.ok).toBe(false);
	expect(resumed.manifest.status).toBe('failed');
	expect(resumed.manifest.steps[0]?.status).toBe('failed');
	// the reason is recorded against the phase, not swallowed
	expect(resumed.manifest.steps[0]?.error ?? '').toMatch(/EACCES/);
	expect(resumed.error ?? '').toMatch(/EACCES/);
});

test("hands an unstarted phase of a resumed sequence the sequence's own baseline", async () => {
	const { dir, overviewPath } = setupCommittablePhasedRepo({ phases: 2 });
	const config = await readConfig({ cwd: dir });
	const parked = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [], parkAt: 1 }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});

	const resumed = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		existing: parked.manifest,
		skipRefactor: true,
	});
	const [first, second] = await readPhaseChildRuns({ cwd: dir, manifest: resumed.manifest });

	// phase 2 never started, so it mints its own run — and what it counts as its own is the
	// sequence's set, taken before the sequence began, not a snapshot of a tree somebody sat in
	expect(second?.baselineDirtyFiles.includes('src/phase1.js')).toBe(true);
	expect((first?.changedFiles ?? []).every((path) => second?.baselineDirtyFiles.includes(path))).toBe(true);
});

test("leaves a started phase's own recorded baseline alone", async () => {
	const { dir, overviewPath } = setupCommittablePhasedRepo({ phases: 2 });
	const config = await readConfig({ cwd: dir });
	const parked = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [], parkAt: 2 }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});
	const [, started] = await readPhaseChildRuns({ cwd: dir, manifest: parked.manifest });

	const resumed = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		existing: parked.manifest,
		skipRefactor: true,
	});
	const [, second] = await readPhaseChildRuns({ cwd: dir, manifest: resumed.manifest });

	// phase 2 already had a run of its own, so it keeps the set that run recorded
	expect(second?.runId).toBe(started?.runId);
	expect(second?.baselineDirtyFiles).toStrictEqual(started?.baselineDirtyFiles);
	expect(second?.baselineDirtyFiles.includes('src/phase1.js')).toBe(false);
});
