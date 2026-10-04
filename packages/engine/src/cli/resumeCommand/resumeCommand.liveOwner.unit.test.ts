import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { resumeCommand } from '#src/cli/resumeCommand/resumeCommand.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { manifestOf, runId, setupResume } from '#tests/helpers/setupResume.ts';

/** The queue run a worker's pointer-form owner record names. */
const queueRunId = 'run-queue-02';

/** Beyond any OS pid range — the live-process probe reports it dead. */
const deadPid = 999_999_999;

/** What stands at the far end of the worker's pointer — every one of them answers for no live process. */
type QueueEnd = 'no queue run' | 'no owner record' | 'a dead owner' | 'a second pointer';

/**
 * A failed queue worker root whose pointer-form owner record names a queue run
 * that cannot answer for a live process. The resumed pipeline stops at its own
 * plan read, so getting past the owner check is observable as the resuming line.
 */
const setupWorkerWithIdleQueue = async ({ queueEnd }: { queueEnd: QueueEnd }) => {
	const seeded = setupResume({ args: ['--run', runId], manifest: manifestOf({ pipeline: 'implement' }) });

	await writeRunOwner({ cwd: seeded.cwd, runId, queueRunId });

	if (queueEnd !== 'no queue run') {
		const queueDir = runDirFor({ cwd: seeded.cwd, runId: queueRunId, pipeline: 'queue' });

		mkdirSync(queueDir, { recursive: true });
		writeFileSync(join(queueDir, 'manifest.json'), JSON.stringify(manifestOf({ runId: queueRunId, pipeline: 'queue', status: RunStatus.Running })));

		if (queueEnd === 'a dead owner') {
			writeFileSync(join(queueDir, 'owner.json'), JSON.stringify({ pid: deadPid, recordedAt: '2026-01-01T00:00:01.000Z' }));
		}

		if (queueEnd === 'a second pointer') {
			await writeRunOwner({ cwd: seeded.cwd, runId: queueRunId, queueRunId: 'run-queue-03' });
		}
	}

	return seeded;
};

describe('resumeCommand', () => {
	test.each<{ queueEnd: QueueEnd }>([
		{ queueEnd: 'no queue run' },
		{ queueEnd: 'no owner record' },
		{ queueEnd: 'a dead owner' },
		{ queueEnd: 'a second pointer' },
	])('resumes a queue worker run whose pointer leads to $queueEnd', async ({ queueEnd }) => {
		const { context, logged, errors } = await setupWorkerWithIdleQueue({ queueEnd });

		const resumed = resumeCommand(context);

		await expect(resumed).rejects.toThrow(/process\.exit/);
		expect({
			resumingLine: logged[0],
			sentToStop: errors.some((line) => line.includes('lightsout stop')),
		}).toStrictEqual({ resumingLine: `lightsout: resuming run ${runId} (was: failed, plan: ghost.md)`, sentToStop: false });
	});
});
