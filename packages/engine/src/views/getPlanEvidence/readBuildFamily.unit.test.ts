import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { readBuildFamily } from '#src/views/getPlanEvidence/readBuildFamily.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

const workOrderName = 'lo-16-demo';
const planName = `${workOrderName}/plan-a`;

/**
 * A phased coordinator whose two steps each name a phase child: the first
 * child's manifest is not JSON at all, the second is a readable run. Real
 * folders on disk, read back through the same lookup a real build uses.
 */
const setupBuildFamily = async () => {
	const cwd = await freshCwd();
	const corruptChildDir = runDirFor({ cwd, runId: 'child-two-run', planName });

	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-coordinator',
			planName,
			pipeline: PipelineKind.Phases,
			steps: [
				{ id: 'phase-1', status: RunStatus.Passed, attempts: 1, report: { runId: 'child-two-run' } },
				{ id: 'phase-2', status: RunStatus.Passed, attempts: 1, report: { runId: 'child-one-run' } },
			],
		},
	});
	await seedRunDir({ cwd, manifest: { runId: 'child-one-run', planName, parentRunId: 'run-coordinator' } });
	await mkdir(corruptChildDir, { recursive: true });
	await writeFile(join(corruptChildDir, 'manifest.json'), 'not json at all', 'utf8');

	return { cwd };
};

/** A coordinator whose two steps both name the same readable phase child, as a resumed phase would. */
const setupRepeatedChild = async () => {
	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: {
			runId: 'run-coordinator',
			planName,
			pipeline: PipelineKind.Phases,
			steps: [
				{ id: 'phase-1', status: RunStatus.Passed, attempts: 1, report: { runId: 'child-one-run' } },
				{ id: 'phase-1-resumed', status: RunStatus.Passed, attempts: 1, report: { runId: 'child-one-run' } },
			],
		},
	});
	await seedRunDir({ cwd, manifest: { runId: 'child-one-run', planName, parentRunId: 'run-coordinator' } });

	return { cwd };
};

describe('readBuildFamily', () => {
	test('readBuildFamily: the build run then the children its step reports name, an unreadable child named as a problem', async () => {
		const { cwd } = await setupBuildFamily();

		const family = await readBuildFamily({ cwd, workOrderName, runId: 'run-coordinator' });

		expect({ runIds: family.runs.map((run) => run.manifest.runId), problems: family.problems }).toEqual({
			runIds: ['run-coordinator', 'child-one-run'],
			problems: [expect.stringContaining('child-tw')],
		});
	});

	test('readBuildFamily: a child two steps name is read once', async () => {
		const { cwd } = await setupRepeatedChild();

		const family = await readBuildFamily({ cwd, workOrderName, runId: 'run-coordinator' });

		expect({ runIds: family.runs.map((run) => run.manifest.runId), problems: family.problems }).toEqual({
			runIds: ['run-coordinator', 'child-one-run'],
			problems: [],
		});
	});

	test('readBuildFamily: a build run that cannot be read answers no run and one problem naming it', async () => {
		const cwd = await freshCwd();

		const family = await readBuildFamily({ cwd, workOrderName, runId: 'missing-build-run' });

		expect(family).toEqual({ runs: [], problems: [expect.stringContaining('missing-')] });
	});
});
