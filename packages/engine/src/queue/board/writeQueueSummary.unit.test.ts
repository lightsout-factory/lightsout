import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { QueueSummary } from '#src/contracts/queue/QueueSummary.ts';
import { readQueueSummary } from '#src/queue/board/readQueueSummary.ts';
import { writeQueueSummary } from '#src/queue/board/writeQueueSummary.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

/** A finished drain's summary with a blank line inside each list, so a write that trims or joins lines shows. */
const finishedSummary: QueueSummary = {
	boardLines: ['Queue finished — 2 tickets', '', '  passed  LO-1  Show the board', '  parked  LO-2  Persist the report'],
	reportLines: ['Passed: LO-1 → https://github.com/lightsout/lightsout/pull/1', '', 'Parked: LO-2 — needs an answer'],
	exitCode: 2,
	finishedAt: '2026-09-10T09:45:00.000Z',
};

/** A main checkout holding one queue run's folder, and an id no run on disk answers to. */
const setupCheckout = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-queue-summary-'));
	const runId = 'run-queue-1';
	const runDir = runDirFor({ cwd, runId, pipeline: 'queue' });

	mkdirSync(runDir, { recursive: true });

	return { cwd, runId, runDir, missingRunId: 'run-queue-missing' };
};

describe('writeQueueSummary', () => {
	test('writes the summary whole and refuses a queue run with no folder', async () => {
		const { cwd, runId, runDir, missingRunId } = setupCheckout();

		await writeQueueSummary({ cwd, runId, summary: finishedSummary });
		const savedSummary = await readQueueSummary({ cwd, runId });
		const refusedWrite = writeQueueSummary({ cwd, runId: missingRunId, summary: finishedSummary });

		await expect(refusedWrite).rejects.toBeInstanceOf(RunNotFoundError);
		expect(savedSummary).toStrictEqual(finishedSummary);
		expect(readdirSync(runDir)).toEqual(['summary.json']);
		expect(readdirSync(cwd, { recursive: true }).filter((entry) => String(entry).includes('summary.json'))).toEqual([
			join('.lightsout', 'queue', 'runs', runId, 'summary.json'),
		]);
	});
});
