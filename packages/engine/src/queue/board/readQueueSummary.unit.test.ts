import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { getQueueSummaryPath } from '#src/queue/board/common/getQueueSummaryPath.ts';
import { readQueueSummary } from '#src/queue/board/readQueueSummary.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

/** An empty main checkout holding the named queue runs, with a hand-written summary file for the cases the queue would never write. */
const setupCheckout = async ({ files = {}, runIds = [] }: { files?: Record<string, string>; runIds?: string[] } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-queue-summary-'));

	// A summary lives in the run's own folder, which is looked up by id — so the
	// folder has to be there before the summary can be filed in it, and a run
	// with no summary of its own still has to be findable.
	for (const runId of new Set([...Object.keys(files), ...runIds])) {
		mkdirSync(runDirFor({ cwd, runId, pipeline: 'queue' }), { recursive: true });
	}

	for (const [runId, contents] of Object.entries(files)) {
		const path = await getQueueSummaryPath({ cwd, runId });

		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, contents);
	}

	return { cwd };
};

describe('readQueueSummary', () => {
	test('answers undefined for a missing, garbled or off-contract summary', async () => {
		const { cwd } = await setupCheckout({
			runIds: ['run-missing'],
			files: {
				'run-garbled': '{ this is not json',
				'run-off-contract': JSON.stringify({
					boardLines: ['queue — finished'],
					exitCode: 0,
					finishedAt: '2026-09-10T09:30:00.000Z',
				}),
			},
		});

		const summaries = await Promise.all([
			readQueueSummary({ cwd, runId: 'run-missing' }),
			readQueueSummary({ cwd, runId: 'run-garbled' }),
			readQueueSummary({ cwd, runId: 'run-off-contract' }),
		]);

		expect(summaries).toEqual([undefined, undefined, undefined]);
	});
});
