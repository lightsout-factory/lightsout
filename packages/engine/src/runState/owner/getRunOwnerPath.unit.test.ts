import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { resolveRunDir } from '#src/runState/common/paths/resolveRunDir.ts';
import { createRun } from '#src/runState/createRun.ts';
import { getRunOwnerPath } from '#src/runState/owner/getRunOwnerPath.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

/**
 * A repository holding one run `createRun` made. Every case gets its own
 * temporary repository, because the run lookup remembers what it found for the
 * life of the process.
 */
const setupRun = async () => {
	const cwd = setupConsumerRepo({ git: false });
	const manifest = await createRun({ cwd, plan: 'plan.md', driver: 'stub' });
	const runDir = await resolveRunDir({ cwd, runId: manifest.runId });

	return { cwd, runId: manifest.runId, runDir };
};

describe('getRunOwnerPath', () => {
	test("names owner.json inside the run's own folder and refuses an unknown run", async () => {
		const { cwd, runId, runDir } = await setupRun();

		const ownerPath = await getRunOwnerPath({ cwd, runId });

		expect(ownerPath).toBe(join(runDir, 'owner.json'));
		await expect(getRunOwnerPath({ cwd, runId: 'no-run-answers-to-this-id' })).rejects.toThrow(RunNotFoundError);
	});
});
