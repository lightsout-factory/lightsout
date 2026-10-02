import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readRunFinalReport } from '#src/runState/finalReport/readRunFinalReport.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

/** An empty checkout holding the named runs, each with a hand-written report.json the command would never write. */
const setupCheckout = ({ files = {}, runIds = [] }: { files?: Record<string, string>; runIds?: string[] } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-final-report-'));

	// A report lives in the run's own folder, which is looked up by id — so a run
	// with no report of its own still needs a folder to be findable.
	for (const runId of new Set([...Object.keys(files), ...runIds])) {
		mkdirSync(runDirFor({ cwd, runId }), { recursive: true });
	}

	for (const [runId, contents] of Object.entries(files)) {
		writeFileSync(join(runDirFor({ cwd, runId }), 'report.json'), contents);
	}

	return { cwd };
};

describe('readRunFinalReport', () => {
	test('answers undefined for a missing, garbled or off-contract report', async () => {
		const { cwd } = setupCheckout({
			runIds: ['run-missing'],
			files: {
				'run-garbled': '{ this is not json',
				'run-off-contract': JSON.stringify({ lines: ['', 'Run: run-off-contract'], exitCode: 1.5, finishedAt: '2026-09-10T09:30:00.000Z' }),
			},
		});

		const reports = await Promise.all([
			readRunFinalReport({ cwd, runId: 'run-missing' }),
			readRunFinalReport({ cwd, runId: 'run-garbled' }),
			readRunFinalReport({ cwd, runId: 'run-off-contract' }),
		]);

		expect(reports).toEqual([undefined, undefined, undefined]);
	});
});
