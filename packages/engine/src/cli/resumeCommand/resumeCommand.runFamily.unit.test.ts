import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { parseFlags } from '#src/cli/parseFlags.ts';
import { resumeCommand } from '#src/cli/resumeCommand/resumeCommand.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { manifestOf, runId, setupResume } from '#tests/helpers/setupResume.ts';

// Mocked Imports
// -------------------------
// What this file pins is how resume answers a run whose family it must not
// continue from here: a root another process still owns, a worker whose queue
// is live, and a phase child its coordinator resumes. The pre-source lifecycle
// guard is doubled and answered `undefined`, so the lifecycle write is never
// the reason a case stops; its own contract is tested beside it.
interface GuardParams {
	cwd: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	ticketRef?: string;
	onProgress?: (message: string) => void;
}

const mockRequireImplementLifecycle = jest.fn<(params: GuardParams) => Promise<string | undefined>>();

jest.mock('#src/ticketLifecycle/requireImplementLifecycle.ts', () => ({
	requireImplementLifecycle: (params: GuardParams) => mockRequireImplementLifecycle(params),
}));
// -------------------------

/** A config this engine accepts, standing for the one a run recorded when it started. */
const recordedConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false }, 'standards-pack': false };

/** Beyond any OS pid range — the live-process probe reports it dead. */
const deadPid = 999_999_999;

/** A second run in the checkout, its owner record naming a process that has since gone. */
const deadOwnerRunId = 'run-dead-owner-01';

/** The queue run a worker's pointer-form owner record names. */
const queueRunId = 'run-queue-01';

/** The phased coordinator a seeded phase child belongs to. */
const coordinatorRunId = 'run-coordinator-01';

/** A seeded run's manifest exactly as its bytes stand on disk, so a refusal can be shown to have written nothing. */
const readManifestText = ({ cwd, id, pipeline }: { cwd: string; id: string; pipeline?: string }): string =>
	readFileSync(join(runDirFor({ cwd, runId: id, pipeline }), 'manifest.json'), 'utf8');

/** Writes a run's manifest, and its owner record when given one, into the folder its id is looked up under. */
const seedRun = ({ cwd, manifest, owner }: { cwd: string; manifest: RunManifest; owner?: Record<string, unknown> }) => {
	const runDir = runDirFor({ cwd, runId: manifest.runId, pipeline: manifest.pipeline });

	mkdirSync(runDir, { recursive: true });
	writeFileSync(join(runDir, 'manifest.json'), JSON.stringify(manifest));

	if (owner !== undefined) {
		writeFileSync(join(runDir, 'owner.json'), JSON.stringify(owner));
	}
};

/**
 * A running implement run this very process owns — so its owner is live — beside
 * a stopped run whose owner record names a dead pid. The guard is answered
 * `undefined`, so the lifecycle write is never the reason a case stops.
 */
const setupOwnedResume = async () => {
	mockRequireImplementLifecycle.mockResolvedValue(undefined);

	const seeded = setupResume({ args: ['--run', runId], manifest: manifestOf({ pipeline: 'implement', status: RunStatus.Running }) });

	seedRun({
		cwd: seeded.cwd,
		manifest: manifestOf({ runId: deadOwnerRunId, pipeline: 'implement', config: recordedConfig }),
		owner: { pid: deadPid, recordedAt: '2026-01-01T00:00:01.000Z' },
	});
	await writeRunOwner({ cwd: seeded.cwd, runId });

	const deadOwnerContext = { flags: parseFlags({ args: ['--run', deadOwnerRunId] }), rest: [], cwd: seeded.cwd };

	return { ...seeded, deadOwnerContext, manifestBefore: readManifestText({ cwd: seeded.cwd, id: runId }) };
};

/** A running queue worker root whose pointer-form owner names a running queue run this very process owns. */
const setupQueueWorkerResume = async () => {
	mockRequireImplementLifecycle.mockResolvedValue(undefined);

	const seeded = setupResume({ args: ['--run', runId], manifest: manifestOf({ pipeline: 'implement', status: RunStatus.Running }) });

	seedRun({ cwd: seeded.cwd, manifest: manifestOf({ runId: queueRunId, pipeline: 'queue', status: RunStatus.Running }) });
	await writeRunOwner({ cwd: seeded.cwd, runId: queueRunId });
	await writeRunOwner({ cwd: seeded.cwd, runId, queueRunId });

	return { ...seeded, manifestBefore: readManifestText({ cwd: seeded.cwd, id: runId }) };
};

/** A failed phase child whose failed coordinator's step names it — resumable in every other respect. */
const setupPhaseChildResume = () => {
	mockRequireImplementLifecycle.mockResolvedValue(undefined);

	const seeded = setupResume({ args: ['--run', runId], manifest: manifestOf({ pipeline: 'implement', parentRunId: coordinatorRunId }) });

	seedRun({
		cwd: seeded.cwd,
		manifest: manifestOf({
			runId: coordinatorRunId,
			pipeline: 'phases',
			plan: join('plans', 'demo', 'overview.md'),
			steps: [{ id: 'phase1.md', status: RunStatus.Failed, attempts: 1, report: { runId } }],
		}),
	});

	const readBoth = () => ({
		child: readManifestText({ cwd: seeded.cwd, id: runId }),
		coordinator: readManifestText({ cwd: seeded.cwd, id: coordinatorRunId, pipeline: 'phases' }),
	});

	return { ...seeded, readBoth, manifestsBefore: readBoth() };
};

describe('resumeCommand', () => {
	test('refuses a run whose family root still has a live owner, before anything is written', async () => {
		const { context, deadOwnerContext, cwd, logged, errors, exitCodes, manifestBefore } = await setupOwnedResume();

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);
		const refusal = [...errors];
		const manifestAfter = readManifestText({ cwd, id: runId });
		// the control: the same command on a run whose owner has gone resumes it
		await expect(resumeCommand(deadOwnerContext)).rejects.toThrow(/process\.exit/);

		// the refusal's wording is human copy; what it must name is the contract
		expect({
			lines: refusal.length,
			namesRun: refusal[0]?.includes(runId),
			namesPid: refusal[0]?.includes(String(process.pid)),
			pointsAtStop: refusal[0]?.includes(`lightsout stop --run ${runId}`),
		}).toStrictEqual({ lines: 1, namesRun: true, namesPid: true, pointsAtStop: true });
		expect(manifestAfter).toBe(manifestBefore);
		expect(logged[0]).toBe(`lightsout: resuming run ${deadOwnerRunId} (was: failed, plan: ghost.md)`);
		expect(exitCodes).toStrictEqual([1, 1]);
	});

	test('a queue worker run with a live queue is sent to stop the queue run', async () => {
		const { context, cwd, logged, errors, exitCodes, manifestBefore } = await setupQueueWorkerResume();

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		const manifestAfter = readManifestText({ cwd, id: runId });

		// stop refuses a worker run, so the line sends the reader to the queue run instead
		expect({
			lines: errors.length,
			namesQueueRun: errors[0]?.includes(queueRunId),
			pointsAtQueueStop: errors[0]?.includes(`lightsout stop --run ${queueRunId}`),
			pointsAtWorkerStop: errors[0]?.includes(`lightsout stop --run ${runId}`),
		}).toStrictEqual({ lines: 1, namesQueueRun: true, pointsAtQueueStop: true, pointsAtWorkerStop: false });
		expect(manifestAfter).toBe(manifestBefore);
		expect(logged).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([1]);
	});

	test("a phase child is sent to its coordinator's resume, before anything is written", async () => {
		const { context, readBoth, logged, errors, exitCodes, manifestsBefore } = setupPhaseChildResume();

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		const manifestsAfter = readBoth();

		// a hint a reader retypes is a contract, pinned exactly as the wrong-pipeline refusal is
		expect(errors).toStrictEqual([`run ${runId} is a phase of sequence ${coordinatorRunId} — resume it with: lightsout resume --run ${coordinatorRunId}`]);
		expect(manifestsAfter).toStrictEqual(manifestsBefore);
		expect(logged).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([1]);
	});
});
