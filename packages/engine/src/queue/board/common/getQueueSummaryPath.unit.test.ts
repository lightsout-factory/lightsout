import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { getQueueSummaryPath } from '#src/queue/board/common/getQueueSummaryPath.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

/** A main checkout with two coordinator runs on disk, and the summary file each run's own folder should hold. */
const setupRuns = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-summary-path-'));
	const runIds = ['run-queue-1', 'run-queue-2'];
	const expectedPaths = runIds.map((runId) => {
		const runDir = runDirFor({ cwd, runId, pipeline: 'queue' });

		mkdirSync(runDir, { recursive: true });

		return join(runDir, 'summary.json');
	});

	return { cwd, runIds, expectedPaths };
};

describe('getQueueSummaryPath', () => {
	test("files the summary in the coordinator run's own folder", async () => {
		const { cwd, runIds, expectedPaths } = setupRuns();

		const summaryPaths = await Promise.all(runIds.map((runId) => getQueueSummaryPath({ cwd, runId })));

		expect(summaryPaths).toEqual(expectedPaths);
		expect(new Set(summaryPaths).size).toBe(2);
	});
});
