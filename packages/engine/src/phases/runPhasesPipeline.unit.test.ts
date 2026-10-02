import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import { PhaseReport } from '#src/contracts/run/PhaseReport.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { runPhasesPipeline } from '#src/phases/runPhasesPipeline.ts';
import { listRunIds } from '#src/runState/listRunIds.ts';
import { describeRunLockHolder } from '#src/runState/lock/describeRunLockHolder.ts';
import { RunLockError } from '#src/runState/lock/RunLockError.ts';
import { getRunOwnerPath } from '#src/runState/owner/getRunOwnerPath.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { createPhaseDriver } from '#tests/helpers/createPhaseDriver.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';
import { readPhaseChildRuns } from '#tests/helpers/readPhaseChildRuns.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupCommittablePhasedRepo } from '#tests/helpers/setupCommittablePhasedRepo.ts';
import { setupPhasedRepo } from '#tests/helpers/setupPhasedRepo.ts';

/** Field-wise sum of what the per-phase runs actually recorded — the number the sequence report must show. */
const totalUsage = ({ children }: { children: RunManifest[] }) =>
	children.reduce(
		(total, child) => ({
			invocations: total.invocations + (child.usage?.invocations ?? 0),
			inputTokens: total.inputTokens + (child.usage?.inputTokens ?? 0),
			outputTokens: total.outputTokens + (child.usage?.outputTokens ?? 0),
			cacheReadTokens: total.cacheReadTokens + (child.usage?.cacheReadTokens ?? 0),
			cacheCreationTokens: total.cacheCreationTokens + (child.usage?.cacheCreationTokens ?? 0),
			costUsd: total.costUsd + (child.usage?.costUsd ?? 0),
		}),
		{ invocations: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0 },
	);

test('runPhasesPipeline: a fresh sequence runs every phase in the overview order and ends passed', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const seen: number[] = [];
	const progress: string[] = [];
	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen }),
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		overviewPath,
		skipRefactor: true,
		onProgress: (message) => progress.push(message),
	});

	// the error rides along so a failure says why, rather than only that it failed
	expect({ ok: result.ok, error: result.error }).toStrictEqual({ ok: true, error: undefined });
	// written order, one per phase, no repeats
	expect(seen).toStrictEqual([1, 2]);
	expect(result.manifest.status).toBe('passed');
	expect(result.manifest.pipeline).toBe('phases');
	expect(result.manifest.plan).toBe(overviewPath);
	expect(result.manifest.currentStep).toBe(null);
	expect(result.manifest.steps.map((step) => step.id)).toStrictEqual(['phase1.md', 'phase2.md']);
	expect(result.manifest.steps.map((step) => step.status)).toStrictEqual(['passed', 'passed']);
	// every step names the per-phase run that implemented it
	expect(result.manifest.steps.every((step) => PhaseReport.safeParse(step.report).success)).toBeTruthy();
	// and each of those runs records the coordinator on its own manifest, so a
	// reader never has to reconstruct the link by opening every other run
	expect((await readPhaseChildRuns({ cwd: dir, manifest: result.manifest })).map((child) => child.parentRunId)).toStrictEqual([
		result.manifest.runId,
		result.manifest.runId,
	]);
	// the sequence's changed files are the union of its phases'
	expect(result.manifest.changedFiles.includes('src/phase1.js')).toBeTruthy();
	expect(result.manifest.changedFiles.includes('src/phase2.js')).toBeTruthy();
	expect(progress.includes('phase 1/2: phase1.md')).toBeTruthy();
	expect(progress.includes('phase 2/2: phase2.md')).toBeTruthy();
});

test('runPhasesPipeline: the coordinator persists its own narration, so a watch between phases has something to say', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const progress: string[] = [];
	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		overviewPath,
		skipRefactor: true,
		onProgress: (message) => progress.push(message),
	});
	const logged = readFileSync(join(runDirFor({ cwd: dir, runId: result.manifest.runId }), 'progress.jsonl'), 'utf8')
		.trim()
		.split('\n')
		.map((line): { at: string; message: string } => JSON.parse(line));

	// the coordinator holds no RunState, so its narration is teed at the one
	// place it narrates — and the caller still hears every line unchanged
	expect(logged.map((entry) => entry.message)).toStrictEqual(progress);
	expect(logged.some((entry) => entry.message === 'phase 1/2: phase1.md')).toBe(true);
	expect(logged.every((entry) => entry.at !== '')).toBe(true);
});

test('runPhasesPipeline: the ship stamp lands on the coordinator alone, never on a phase run', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		overviewPath,
		skipRefactor: true,
		willShip: true,
	});
	const children = await readPhaseChildRuns({ cwd: dir, manifest: result.manifest });

	// only the coordinator ships — a phase run carrying the stamp would draw a
	// ship row nothing will ever fill
	expect(result.manifest.willShip).toBe(true);
	expect(children.map((child) => child.willShip)).toStrictEqual([undefined, undefined]);
});

test('runPhasesPipeline: the sequence report carries its phases tokens, cost, and working time', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [], usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 7, cacheCreationTokens: 3, costUsd: 0.25 } }),
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		overviewPath,
		skipRefactor: true,
	});
	const children = await readPhaseChildRuns({ cwd: dir, manifest: result.manifest });

	expect(result.ok).toBe(true);
	// an overnight run's report must show what the whole sequence cost
	expect(result.manifest.usage).toStrictEqual(totalUsage({ children }));
	expect(result.manifest.usage?.invocations).toBeGreaterThan(0);
	// each phase's time is its child's working time, not the coordinator's wall clock
	expect(result.manifest.steps.map((step) => step.durationMs)).toStrictEqual(
		children.map((child) => child.steps.reduce((total, step) => total + (step.durationMs ?? 0), 0)),
	);
});

test('runPhasesPipeline: a phase that ends short stops the sequence right there and names the resume command', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 3 });
	const seen: number[] = [];
	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen, failAt: 2 }),
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		overviewPath,
		skipRefactor: true,
	});

	expect(result.ok).toBe(false);
	// phase 3 was never attempted
	expect(seen).toStrictEqual([1, 2]);
	expect(result.manifest.status).toBe('failed');
	expect(result.manifest.steps.map((step) => step.status)).toStrictEqual(['passed', 'failed', 'pending']);
	expect(result.error ?? '').toMatch(/phase 2\/3 \(phase2\.md\) ended failed/);
	expect((result.error ?? '').includes(`resume with: lightsout resume --run ${result.manifest.runId}`)).toBeTruthy();
	// the phase's own failure text rides along
	expect(result.error ?? '').toMatch(/PHASE-2-FAILURE/);
});

test('runPhasesPipeline: --start-phase records the earlier phases as done outside the sequence and never runs them', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const seen: number[] = [];
	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen }),
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		overviewPath,
		startPhase: 2,
		skipRefactor: true,
	});

	expect(result.ok).toBe(true);
	expect(seen).toStrictEqual([2]);
	// adopted, not implemented: passed with nothing spent on it
	expect(result.manifest.steps[0]).toStrictEqual({ id: 'phase1.md', status: 'passed', attempts: 0 });
});

test("hands a fresh sequence's run id to its coordinator and never to a phase's run", async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		overviewPath,
		runId: 'pre-minted-sequence-run',
		skipRefactor: true,
	});
	const children = await readPhaseChildRuns({ cwd: dir, manifest: result.manifest });

	// the caller named the run before it started, so the record that names it
	// points at the coordinator that exists
	expect(result.manifest.runId).toBe('pre-minted-sequence-run');
	// a phase's own run mints its own id under the parent link — a child sharing
	// the coordinator's id would overwrite the coordinator's manifest
	expect(children.map((child) => child.runId).includes('pre-minted-sequence-run')).toBe(false);
	expect(children.map((child) => child.parentRunId)).toStrictEqual(['pre-minted-sequence-run', 'pre-minted-sequence-run']);
});

test("gathers every phase's commit onto the coordinator manifest", async () => {
	const { dir, overviewPath } = setupCommittablePhasedRepo({ phases: 2 });
	const config = await readConfig({ cwd: dir });

	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});
	const children = await readPhaseChildRuns({ cwd: dir, manifest: result.manifest });

	// one entry per phase, in phase order, each naming the phase's own run — a coordinator that commits nothing itself still reports what the sequence left
	expect(result.manifest.commits.map((commit) => commit.runId)).toStrictEqual(children.map((child) => child.runId));
	expect(result.manifest.commits.map((commit) => commit.subject)).toEqual([expect.stringContaining('phase1'), expect.stringContaining('phase2')]);
	expect(result.manifest.commits.every((commit) => /^[0-9a-f]{7,}$/.test(commit.sha))).toBe(true);
});

test("leaves a fresh sequence's phases unguarded", async () => {
	const { dir, overviewPath } = setupCommittablePhasedRepo({ phases: 2 });
	const config = await readConfig({ cwd: dir });

	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});
	const [first, second] = await readPhaseChildRuns({ cwd: dir, manifest: result.manifest });

	// nothing is inherited on a first sequence: phase 2 starts from its own snapshot of the tree phase 1's commit left clean
	expect(first?.changedFiles.includes('src/phase1.js')).toBe(true);
	expect((first?.changedFiles ?? []).some((path) => second?.baselineDirtyFiles.includes(path))).toBe(false);
});

/** `src/`'s file listing, as a node expression — the one input the fixture's build output is built from. */
const srcListing = "require('fs').readdirSync('src').sort().join(',')";

/**
 * A two-phase repo listing `dist/` under `generated` with no `gates.generate`.
 *
 * By default `dist/listing.txt` is committed built from `src/`'s listing, so the
 * source file each phase's stub adds leaves it stale until a gate rebuilds it:
 * `build` rebuilds it from the working source and `check` fails whenever it
 * disagrees. Clean-slate runs the check alone and every verify checkpoint
 * rebuilds then checks, so stale output can fail only at a later phase's
 * clean-slate. `rebuilds: false` keeps the default gates, which never touch
 * `dist/`; `generated: false` lists no generated paths at all.
 */
const setupBuildOutputRepo = async ({ generated = true, rebuilds = true }: { generated?: boolean; rebuilds?: boolean } = {}) => {
	const { dir, overviewPath } = setupCommittablePhasedRepo({ phases: 2 });
	const configPath = join(dir, 'lightsout.config.json');
	const written: { gates: Record<string, unknown> } = JSON.parse(readFileSync(configPath, 'utf8'));
	const builtFrom = readdirSync(join(dir, 'src')).sort().join(',');
	const rebuilding = {
		gates: {
			...written.gates,
			build: `node -e "require('fs').mkdirSync('dist',{recursive:true});require('fs').writeFileSync('dist/listing.txt',${srcListing})"`,
			check: `node -e "process.exit(require('fs').readFileSync('dist/listing.txt','utf8')===${srcListing}?0:1)"`,
		},
		'gate-overrides': {
			'clean-slate': ['check'],
			'verify-implement': ['build', 'check'],
			'verify-tests': ['build', 'check'],
			'verify-refactor': ['build', 'check'],
		},
	};

	writeFileSync(configPath, JSON.stringify({ ...written, ...(generated ? { generated: ['dist/'] } : {}), ...(rebuilds ? rebuilding : {}) }));

	if (rebuilds) {
		mkdirSync(join(dir, 'dist'), { recursive: true });
		writeFileSync(join(dir, 'dist', 'listing.txt'), builtFrom);
	}

	execSync('git add -A && git commit -q --allow-empty -m "build output"', { cwd: dir, stdio: 'ignore' });

	return { dir, overviewPath, builtFrom, config: await readConfig({ cwd: dir }) };
};

/** Runs the arranged sequence to its end and keeps the carried-output discard lines it narrated. */
const narrateSequence = async ({ dir, overviewPath, config }: Awaited<ReturnType<typeof setupBuildOutputRepo>>) => {
	const progress: string[] = [];
	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
		onProgress: (message) => progress.push(message),
	});

	return { ok: result.ok, discards: progress.filter((line) => /carried generated path/.test(line)) };
};

test('starts each phase from build output that matches the source the previous phase committed', async () => {
	const { dir, overviewPath, config } = await setupBuildOutputRepo();

	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});

	// phase 1 added a source file, so phase 2's clean-slate check passes only on the
	// output phase 1 rebuilt — the output the branch started from lists one file too few
	expect({ ok: result.ok, error: result.error }).toStrictEqual({ ok: true, error: undefined });
	expect(result.manifest.steps.map((step) => step.status)).toStrictEqual(['passed', 'passed']);
});

test('keeps generated paths out of every phase commit and discards the carried output once the sequence passes', async () => {
	const { dir, overviewPath, config, builtFrom } = await setupBuildOutputRepo();

	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});
	const committed = result.manifest.commits.map((commit) =>
		execSync(`git show --name-only --pretty=format: ${commit.sha}`, { cwd: dir }).toString().split('\n').filter(Boolean),
	);

	expect(result.ok).toBe(true);
	// each phase still committed its source, and no commit carries build output
	expect(committed.map((paths) => paths.some((path) => path.startsWith('src/')))).toStrictEqual([true, true]);
	expect(committed.flat().filter((path) => path.startsWith('dist/'))).toStrictEqual([]);
	// the passed sequence leaves the tree as a single-phase build does: clean, with
	// the build output the branch started from
	expect(execSync('git status --porcelain', { cwd: dir }).toString()).toBe('');
	expect(readFileSync(join(dir, 'dist', 'listing.txt'), 'utf8')).toBe(builtFrom);
});

test('narrates the carried-output discard only when there was carried output to discard', async () => {
	const repos = await Promise.all([
		setupBuildOutputRepo({ rebuilds: false }),
		setupBuildOutputRepo({ generated: false, rebuilds: false }),
		setupBuildOutputRepo(),
	]);

	const [unchanged, unlisted, carried] = await Promise.all(repos.map((repo) => narrateSequence(repo)));

	// a discard that found nothing to discard says nothing
	expect(unchanged).toStrictEqual({ ok: true, discards: [] });
	expect(unlisted).toStrictEqual({ ok: true, discards: [] });
	// only dist/listing.txt was carried
	expect(carried).toEqual({ ok: true, discards: [expect.stringMatching(/discarded 1 carried generated path/)] });
});

/** A lock on the checkout held by this live test process, as a run that is still going leaves it. */
const plantLiveLock = ({ dir }: { dir: string }) => {
	const holder = { pid: process.pid, runId: 'already-running', startedAt: '2026-01-01T00:00:00.000Z' };

	mkdirSync(join(dir, '.lightsout'), { recursive: true });
	writeFileSync(join(dir, '.lightsout', 'lock.json'), JSON.stringify(holder));

	return holder;
};

/** The driver, with `onFirstInvoke` run once inside the sequence's first agent invocation — while the first phase's run is going — before the stub answers it. */
const withFirstInvocation = ({ driver, onFirstInvoke }: { driver: Driver; onFirstInvoke: () => Promise<void> }): Driver => {
	let fired = false;

	return {
		...driver,
		invoke: async (invocation) => {
			if (!fired) {
				fired = true;
				await onFirstInvoke();
			}

			return driver.invoke(invocation);
		},
	};
};

/** The one phase run a sequence has created so far: every run in the checkout but its coordinator. */
const readFirstPhaseRunId = async ({ cwd, coordinatorRunId }: { cwd: string; coordinatorRunId: string }) => {
	const runIds = await listRunIds({ cwd });

	return runIds.filter((runId) => runId !== coordinatorRunId)[0];
};

test('runPhasesPipeline: a live run lock refuses a fresh sequence before its coordinator run exists', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const holder = plantLiveLock({ dir });
	const seen: number[] = [];

	const error = await getRejectionError({
		promise: runPhasesPipeline({
			cwd: dir,
			driver: createPhaseDriver({ dir, seen }),
			config: await readConfig({ cwd: dir }),
			loadedConfig: { config: await readConfig({ cwd: dir }) },
			overviewPath,
			skipRefactor: true,
		}),
	});
	const runIds = await listRunIds({ cwd: dir });

	// the refusal is the lock's own, worded as every other refusal of a live holder is
	expect(error).toBeInstanceOf(RunLockError);
	expect(error.message).toBe(describeRunLockHolder({ holder }));
	// a refused start leaves no run behind — no coordinator manifest and no owner record to read as a start
	expect(seen).toStrictEqual([]);
	expect(runIds).toStrictEqual([]);
});

test('runPhasesPipeline: a live run lock refuses a resumed sequence before anything is rewritten', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const config = await readConfig({ cwd: dir });
	const parked = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [], parkAt: 1 }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});
	const runId = parked.manifest.runId;
	const before = await readRunManifest({ cwd: dir, runId });
	const ownerBefore = await readRunOwner({ cwd: dir, runId });
	const seen: number[] = [];

	plantLiveLock({ dir });

	const error = await getRejectionError({
		promise: runPhasesPipeline({ cwd: dir, driver: createPhaseDriver({ dir, seen }), config, loadedConfig: { config }, existing: before, skipRefactor: true }),
	});
	const after = await readRunManifest({ cwd: dir, runId });
	const ownerAfter = await readRunOwner({ cwd: dir, runId });

	expect(error).toBeInstanceOf(RunLockError);
	expect(seen).toStrictEqual([]);
	// neither the steps nor the owner record were touched — a rewritten owner would carry a fresh recordedAt
	expect(after.steps).toStrictEqual(before.steps);
	expect(ownerBefore).toEqual(expect.objectContaining({ pid: process.pid }));
	expect(ownerAfter).toStrictEqual(ownerBefore);
});

test('runPhasesPipeline: the coordinator owns the family and no phase run gets an owner record', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		overviewPath,
		skipRefactor: true,
	});

	const children = await readPhaseChildRuns({ cwd: dir, manifest: result.manifest });
	const coordinatorOwner = await readRunOwner({ cwd: dir, runId: result.manifest.runId });
	const childOwners = await Promise.all(children.map((child) => readRunOwner({ cwd: dir, runId: child.runId })));

	expect(result.ok).toBe(true);
	expect(coordinatorOwner).toEqual(expect.objectContaining({ pid: process.pid }));
	// one identity per family: a phase run answers through its coordinator
	expect(childOwners).toStrictEqual([undefined, undefined]);
});

test("runPhasesPipeline: the running step names its child before the child's first agent runs", async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const coordinatorRunId = 'pre-minted-sequence-run';
	const observed: { step?: StepRecord; childRunId?: string } = {};
	const driver = withFirstInvocation({
		driver: createPhaseDriver({ dir, seen: [] }),
		onFirstInvoke: async () => {
			const coordinator = await readRunManifest({ cwd: dir, runId: coordinatorRunId });
			const child = await readRunManifest({ cwd: dir, runId: (await readFirstPhaseRunId({ cwd: dir, coordinatorRunId })) ?? '' });

			observed.step = coordinator.steps[0];
			observed.childRunId = child.runId;
		},
	});

	await runPhasesPipeline({
		cwd: dir,
		driver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		overviewPath,
		runId: coordinatorRunId,
		skipRefactor: true,
	});

	// a first attempt names its child too, so a reader can tell which run of the family is moving
	expect(typeof observed.childRunId).toBe('string');
	expect({ status: observed.step?.status, report: observed.step?.report }).toStrictEqual({ status: 'running', report: { runId: observed.childRunId } });
});

test('runPhasesPipeline: a coordinator whose owner record names another process stops without recording the phase', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const coordinatorRunId = 'pre-minted-sequence-run';
	const driver = withFirstInvocation({
		driver: createPhaseDriver({ dir, seen: [] }),
		onFirstInvoke: async () => {
			// another process took the run over while this phase was going
			writeFileSync(await getRunOwnerPath({ cwd: dir, runId: coordinatorRunId }), JSON.stringify({ pid: 4242, recordedAt: '2026-09-30T09:00:00.000Z' }));
		},
	});

	const error = await getRejectionError({
		promise: runPhasesPipeline({
			cwd: dir,
			driver,
			config: await readConfig({ cwd: dir }),
			loadedConfig: { config: await readConfig({ cwd: dir }) },
			overviewPath,
			runId: coordinatorRunId,
			skipRefactor: true,
		}),
	});
	const manifest = await readRunManifest({ cwd: dir, runId: coordinatorRunId });
	const childRunId = await readFirstPhaseRunId({ cwd: dir, coordinatorRunId });

	expect(error.message).toContain('4242');
	// still the running record written before the child started — no outcome, no attempt spent
	expect(manifest.steps[0]).toEqual(expect.objectContaining({ status: 'running', attempts: 0, report: { runId: childRunId } }));
	expect(manifest.steps[1]?.status).toBe('pending');
});

test.each([
	{
		situation: 'its owner record is gone',
		queueRunId: undefined,
		replaceOwner: (ownerPath: string) => rmSync(ownerPath),
		named: /no owner record/,
	},
	{
		situation: 'its owner record points at another queue run',
		queueRunId: 'q-1',
		replaceOwner: (ownerPath: string) => writeFileSync(ownerPath, JSON.stringify({ queueRunId: 'q-2' })),
		named: /q-2/,
	},
])('runPhasesPipeline: a coordinator whose $situation stops without recording the phase', async ({ queueRunId, replaceOwner, named }) => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const coordinatorRunId = 'pre-minted-sequence-run';
	const driver = withFirstInvocation({
		driver: createPhaseDriver({ dir, seen: [] }),
		onFirstInvoke: async () => replaceOwner(await getRunOwnerPath({ cwd: dir, runId: coordinatorRunId })),
	});

	const error = await getRejectionError({
		promise: runPhasesPipeline({
			cwd: dir,
			driver,
			config: await readConfig({ cwd: dir }),
			loadedConfig: { config: await readConfig({ cwd: dir }) },
			overviewPath,
			runId: coordinatorRunId,
			skipRefactor: true,
			queueRunId,
		}),
	});
	const manifest = await readRunManifest({ cwd: dir, runId: coordinatorRunId });

	// the refusal says what the record now names, and the step is still the running record — no outcome written
	expect(error.message).toMatch(named);
	expect({ first: manifest.steps[0]?.status, attempts: manifest.steps[0]?.attempts, second: manifest.steps[1]?.status }).toStrictEqual({
		first: 'running',
		attempts: 0,
		second: 'pending',
	});
});

test('runPhasesPipeline: a queue worker sequence passes its owner fence on the pointer form', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });

	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		overviewPath,
		skipRefactor: true,
		queueRunId: 'q-1',
	});
	const owner = await readRunOwner({ cwd: dir, runId: result.manifest.runId });

	expect({ ok: result.ok, error: result.error }).toStrictEqual({ ok: true, error: undefined });
	expect(result.manifest.steps.map((step) => step.status)).toStrictEqual(['passed', 'passed']);
	expect(owner).toStrictEqual({ queueRunId: 'q-1' });
});

test('runPhasesPipeline: a phase whose child throws keeps its child for the resume to adopt', async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 1 });
	const config = await readConfig({ cwd: dir });
	const coordinatorRunId = 'pre-minted-sequence-run';
	const saved: { manifestPath?: string; content?: string } = {};
	const driver = withFirstInvocation({
		driver: createPhaseDriver({ dir, seen: [] }),
		onFirstInvoke: async () => {
			// a directory now stands where the phase run's manifest was, so the run's
			// next manifest write throws out of its pipeline after the run exists —
			// unlike permission bits, this holds for a root user too
			const childDir = runDirFor({ cwd: dir, runId: (await readFirstPhaseRunId({ cwd: dir, coordinatorRunId })) ?? '' });

			saved.manifestPath = join(childDir, 'manifest.json');
			saved.content = readFileSync(saved.manifestPath, 'utf8');
			rmSync(saved.manifestPath);
			mkdirSync(saved.manifestPath);
		},
	});

	const failed = await runPhasesPipeline({ cwd: dir, driver, config, loadedConfig: { config }, overviewPath, runId: coordinatorRunId, skipRefactor: true });

	// the phase run's manifest comes back as it stood when the run was cut short
	rmSync(saved.manifestPath ?? '', { recursive: true });
	writeFileSync(saved.manifestPath ?? '', saved.content ?? '');

	const childRunId = (await readFirstPhaseRunId({ cwd: dir, coordinatorRunId })) ?? '';
	const resumed = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		existing: failed.manifest,
		skipRefactor: true,
	});
	const runIds = await listRunIds({ cwd: dir });

	expect(failed.manifest.steps[0]).toEqual(expect.objectContaining({ status: 'failed', report: { runId: childRunId } }));
	// the resume continued the partly built run rather than minting a second one
	expect(PhaseReport.parse(resumed.manifest.steps[0]?.report).runId).toBe(childRunId);
	expect([...runIds].sort()).toStrictEqual([coordinatorRunId, childRunId].sort());
});
