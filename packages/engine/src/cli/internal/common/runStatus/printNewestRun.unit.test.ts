import { describe, expect, test } from '@jest/globals';
import { printNewestRun } from '#src/cli/internal/common/runStatus/printNewestRun.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

const olderRunId = 'aaaa0000-older-run';
const newerRunId = 'bbbb1111-newer-run';

/**
 * Two finished runs in one checkout — the newer one updated last — and a second
 * checkout with no runs at all, so one case reads both answers.
 */
const setupNewestRun = async () => {
	const cwd = await freshCwd();
	const emptyCwd = await freshCwd();

	for (const [runId, updatedAt] of [
		[olderRunId, '2026-09-10T10:00:00.000Z'],
		[newerRunId, '2026-09-10T11:00:00.000Z'],
	] as const) {
		await seedRunDir({
			cwd,
			manifest: {
				runId,
				createdAt: '2026-09-10T09:00:00.000Z',
				updatedAt,
				status: RunStatus.Passed,
				currentStep: null,
				steps: [{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 60_000 }],
			},
		});
	}

	const { logged } = captureCommandOutput();

	return { cwd, emptyCwd, logged };
};

describe('printNewestRun', () => {
	test('answers the id of the run it printed, or undefined when there is none', async () => {
		const { cwd, emptyCwd, logged } = await setupNewestRun();

		const printedRunId = await printNewestRun({ cwd });
		const noRunId = await printNewestRun({ cwd: emptyCwd });

		expect({ printedRunId, noRunId, lastLine: logged.at(-1) }).toStrictEqual({
			printedRunId: newerRunId,
			noRunId: undefined,
			lastLine: 'no runs found',
		});
	});
});
