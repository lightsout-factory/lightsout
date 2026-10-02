import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { getRunFinalReportPath } from '#src/runState/finalReport/getRunFinalReportPath.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

/** A checkout with two runs on disk, and the report file each run's own folder should hold. */
const setupRuns = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-final-report-path-'));
	const runIds = ['run-report-1', 'run-report-2'];
	const expectedPaths = runIds.map((runId) => {
		const runDir = runDirFor({ cwd, runId });

		mkdirSync(runDir, { recursive: true });

		return join(runDir, 'report.json');
	});

	return { cwd, runIds, expectedPaths };
};

describe('getRunFinalReportPath', () => {
	test("files the final report in the run's own folder and refuses an unknown run", async () => {
		const { cwd, runIds, expectedPaths } = setupRuns();

		const reportPaths = await Promise.all(runIds.map((runId) => getRunFinalReportPath({ cwd, runId })));

		expect(reportPaths).toEqual(expectedPaths);
		expect(new Set(reportPaths).size).toBe(2);
		await expect(getRunFinalReportPath({ cwd, runId: 'no-run-answers-to-this-id' })).rejects.toThrow(RunNotFoundError);
	});
});
