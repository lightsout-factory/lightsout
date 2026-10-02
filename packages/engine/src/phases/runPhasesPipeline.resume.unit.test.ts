import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import { PhaseReport } from '#src/contracts/run/PhaseReport.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { runPhasesPipeline } from '#src/phases/runPhasesPipeline.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { writeRunManifest } from '#src/runState/writeRunManifest.ts';
import { commitAll } from '#tests/helpers/commitAll.ts';
import { committedPaths } from '#tests/helpers/committedPaths.ts';
import { createPhaseDriver } from '#tests/helpers/createPhaseDriver.ts';
import { readPhaseChildRuns } from '#tests/helpers/readPhaseChildRuns.ts';
import { report } from '#tests/helpers/report.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { runInRepo } from '#tests/helpers/runInRepo.ts';
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

/** An `onProgress` that leaves an uncommitted notes/stray.md in the checkout the moment phase 2's label is narrated — an edit made mid-build. */
const writeStrayAtPhaseTwo =
	({ dir }: { dir: string }) =>
	(message: string) => {
		if (message === 'phase 2/2: phase2.md') {
			mkdirSync(join(dir, 'notes'), { recursive: true });
			writeFileSync(join(dir, 'notes/stray.md'), 'a note the person left\n');
		}
	};

/** The stray file's git status line: present on disk and never committed. */
const strayStatus = ({ dir }: { dir: string }) =>
	runInRepo({ cwd: dir, command: 'git', args: ['status', '--porcelain', '--untracked-files=all', '--', 'notes/stray.md'] }).trim();

/**
 * `createPhaseDriver` for every invocation except phase 2's implement agent, which
 * applies the declared `phase1` → `renamed1` rename by hand: the committed module
 * moved to its renamed path with its one token renamed. The test-change reviewer
 * and the ledger writer are named by their headings, as the rename-only pipeline
 * test names them, and left to the phase stub.
 */
const createRenamingPhaseDriver = ({ dir }: { dir: string }): Driver => {
	const phases = createPhaseDriver({ dir, seen: [] });

	return {
		name: 'stub',
		invoke: async (params) => {
			const { prompt, systemPrompt } = params;
			const reviewOrLedger = prompt.includes('# Changed test-side files') || prompt.includes('# Ledger tests to write');

			if (reviewOrLedger || roleOf(prompt) !== 'implement' || systemPrompt?.includes('PHASE-2-SENTINEL') !== true) {
				return phases.invoke(params);
			}

			rmSync(join(dir, 'src/phase1.js'), { force: true });
			writeFileSync(join(dir, 'src/renamed1.js'), 'export const renamed1 = 1;\n');

			return { text: report({ changedFiles: [{ path: 'src/renamed1.js', summary: 'moved from src/phase1.js' }] }), exitCode: 0 };
		},
	};
};

test('an unstarted phase of a resumed sequence baselines from its own clean snapshot', async () => {
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
	const [, second] = await readPhaseChildRuns({ cwd: dir, manifest: resumed.manifest });

	// phase 1 committed its file before phase 2 began, so phase 2's own snapshot is clean and claims none of it
	expect({ baseline: second?.baselineDirtyFiles, claimsPhaseOne: second?.changedFiles.includes('src/phase1.js') }).toStrictEqual({
		baseline: [],
		claimsPhaseOne: false,
	});
});

test('refuses to start an unstarted phase of a resumed sequence when the checkout holds an uncommitted edit', async () => {
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
	const seen: number[] = [];

	const refused = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen }),
		config,
		loadedConfig: { config },
		existing: parked.manifest,
		skipRefactor: true,
		onProgress: writeStrayAtPhaseTwo({ dir }),
	});

	// phase 1 finished; phase 2 was stopped before its agent ran, and the step still reads as never started
	expect({
		ok: refused.ok,
		seen,
		status: refused.manifest.status,
		currentStep: refused.manifest.currentStep,
		stepTwo: refused.manifest.steps[1]?.status,
		stepTwoReport: refused.manifest.steps[1]?.report,
		stray: strayStatus({ dir }),
	}).toStrictEqual({
		ok: false,
		seen: [1],
		status: 'failed',
		currentStep: 'phase2.md',
		stepTwo: 'pending',
		stepTwoReport: undefined,
		stray: '?? notes/stray.md',
	});
	expect(refused.error).toEqual(expect.stringContaining('notes/stray.md'));
	expect(refused.error).toEqual(expect.stringContaining(`lightsout resume --run ${parked.manifest.runId}`));
});

test('a refused phase starts on resume once the checkout is clean', async () => {
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
	const refused = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		existing: parked.manifest,
		skipRefactor: true,
		onProgress: writeStrayAtPhaseTwo({ dir }),
	});
	const seen: number[] = [];

	rmSync(join(dir, 'notes'), { recursive: true, force: true });

	const resumed = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen }),
		config,
		loadedConfig: { config },
		existing: refused.manifest,
		skipRefactor: true,
	});

	// only the refused phase runs; the one that passed before the refusal is not bought again
	expect({ ok: resumed.ok, status: resumed.manifest.status, seen }).toStrictEqual({ ok: true, status: 'passed', seen: [2] });
});

test('the phase that was mid-way at the pause continues without the first-start clean-tree check', async () => {
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
	const seen: number[] = [];

	mkdirSync(join(dir, 'notes'), { recursive: true });
	writeFileSync(join(dir, 'notes/stray.md'), 'a note the person left\n');

	const resumed = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen }),
		config,
		loadedConfig: { config },
		existing: parked.manifest,
		skipRefactor: true,
	});

	// phase 1 already names a run of its own, so its agent is handed the phase again rather than the
	// phase being refused as not started; whatever the commit then says about the stray file is its own judgement
	expect({
		firstSeen: seen[0],
		judgedAsNotStarted: /not (been )?started|did not start|holds uncommitted changes/i.test(resumed.error ?? ''),
	}).toStrictEqual({ firstSeen: 1, judgedAsNotStarted: false });
});

test('a rename-only phase started after a resume passes its rename check on correct renames', async () => {
	const { dir, overviewPath } = setupCommittablePhasedRepo({ phases: 2 });

	writeFileSync(join(dir, 'plans/demo/phase2.md'), '# Feature — Phase 2\n\nPHASE-2-SENTINEL\n\n## Renames\n\n- `phase1` → `renamed1`\n');
	commitAll({ cwd: dir, message: 'declare the rename' });

	const config = await readConfig({ cwd: dir });
	const parked = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [], parkAt: 1 }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});
	const progress: string[] = [];

	const resumed = await runPhasesPipeline({
		cwd: dir,
		driver: createRenamingPhaseDriver({ dir }),
		config,
		loadedConfig: { config },
		existing: parked.manifest,
		skipRefactor: true,
		onProgress: (message) => {
			progress.push(message);
		},
	});
	const [, second] = await readPhaseChildRuns({ cwd: dir, manifest: resumed.manifest });

	// phase 2 starts from phase 1's commit, so the moved module pairs with its removed original
	expect({
		ok: resumed.ok,
		status: resumed.manifest.status,
		phaseTwo: second?.status,
		renameCheckPassed: progress.some((line) => line.includes('every changed file holds only the declared renames')),
		committed: committedPaths({ cwd: dir }).includes('src/renamed1.js'),
	}).toStrictEqual({ ok: true, status: 'passed', phaseTwo: 'passed', renameCheckPassed: true, committed: true });
});
