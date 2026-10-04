import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { PhaseReport } from '#src/contracts/run/PhaseReport.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { runPhasesPipeline } from '#src/phases/runPhasesPipeline/runPhasesPipeline.ts';
import { listRunIds } from '#src/runState/listRunIds.ts';
import { describeRunLockHolder } from '#src/runState/lock/describeRunLockHolder.ts';
import { RunLockError } from '#src/runState/lock/RunLockError.ts';
import { getRunOwnerPath } from '#src/runState/owner/common/getRunOwnerPath.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { createPhaseDriver } from '#tests/helpers/createPhaseDriver.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';
import { readPhaseChildRuns } from '#tests/helpers/readPhaseChildRuns.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupPhasedRepo } from '#tests/helpers/setupPhasedRepo.ts';

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
