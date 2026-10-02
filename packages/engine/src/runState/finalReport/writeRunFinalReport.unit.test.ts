import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { RunFinalReport } from '#src/contracts/run/RunFinalReport.ts';
import { readRunFinalReport } from '#src/runState/finalReport/readRunFinalReport.ts';
import { writeRunFinalReport } from '#src/runState/finalReport/writeRunFinalReport.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

/** The report an earlier command saved when it parked the run. */
const earlierReport: RunFinalReport = {
	lines: ['', 'Run:      run-final-1', 'Status:   paused-rate-limit', '', 'rate limit reached'],
	exitCode: 2,
	finishedAt: '2026-09-30T08:00:00.000Z',
};

/** The report the command that last ended the run saves — a different shape in every field, so a merge or a stale read shows. */
const laterReport: RunFinalReport = {
	lines: ['', 'Run:      run-final-1', 'Status:   passed', 'Branch:   lo-1-show-the-report'],
	exitCode: 0,
	finishedAt: '2026-10-01T09:30:00.000Z',
};

/** A checkout holding one implement run's folder, with the earlier command's report already saved in it. */
const setupRun = async () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-final-report-'));
	const runId = 'run-final-1';
	const runDir = runDirFor({ cwd, runId });

	mkdirSync(runDir, { recursive: true });
	await writeRunFinalReport({ cwd, runId, report: earlierReport });

	return { cwd, runId, runDir };
};

describe('writeRunFinalReport', () => {
	test('writes the report whole and a later write replaces it', async () => {
		const { cwd, runId, runDir } = await setupRun();

		await writeRunFinalReport({ cwd, runId, report: laterReport });

		const readBack = await readRunFinalReport({ cwd, runId });
		const files = readdirSync(runDir);

		expect(readBack).toStrictEqual(laterReport);
		expect(files).toStrictEqual(['report.json']);
	});
});
