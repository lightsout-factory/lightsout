import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readProcessStartTime } from '#src/common/processes/readProcessStartTime.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

interface SetupParams {
	/** Written to the run's owner.json verbatim before the act; omitted means the run has no owner record yet. */
	owner?: Record<string, unknown>;
}

/** A checkout holding one implement run's folder, optionally with an owner record already in it. */
const setupRun = ({ owner }: SetupParams = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-run-owner-'));
	const runId = 'run-owner-1';
	const runDir = runDirFor({ cwd, runId });

	mkdirSync(runDir, { recursive: true });

	if (owner !== undefined) {
		writeFileSync(join(runDir, 'owner.json'), JSON.stringify(owner), 'utf8');
	}

	return { cwd, runId, runDir };
};

interface SetupWithReportParams {
	/** Whether the run's folder already holds a report.json saved by an earlier command. */
	withReport: boolean;
}

/** A checkout holding one run's folder, optionally with an earlier attempt's saved final report in it. */
const setupRunWithReport = ({ withReport }: SetupWithReportParams) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-run-owner-report-'));
	const runId = 'run-owner-report-1';
	const runDir = runDirFor({ cwd, runId });

	mkdirSync(runDir, { recursive: true });

	if (withReport) {
		const report = { lines: ['', 'Status: passed'], exitCode: 0, finishedAt: '2026-09-28T10:00:00.000Z' };

		writeFileSync(join(runDir, 'report.json'), JSON.stringify(report), 'utf8');
	}

	return { cwd, runId, runDir };
};

describe('writeRunOwner', () => {
	test("records this process's pid and start time and leaves no temporary file", async () => {
		const { cwd, runId, runDir } = setupRun();
		const startTime = await readProcessStartTime({ pid: process.pid });
		const expected = {
			pid: process.pid,
			...(startTime === undefined ? {} : { processStartTime: startTime }),
			recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
		};

		const written = await writeRunOwner({ cwd, runId });

		const readBack = await readRunOwner({ cwd, runId });
		const files = readdirSync(runDir);

		expect(written).toEqual(expected);
		expect(readBack).toEqual(written);
		expect(files).toStrictEqual(['owner.json']);
	});

	test('replaces an existing record with the pointer form when handed a queue run id', async () => {
		const { cwd, runId, runDir } = setupRun({
			owner: { pid: 4242, processStartTime: 'Mon Sep 28 10:00:00 2026', recordedAt: '2026-09-28T10:00:00.000Z' },
		});

		const written = await writeRunOwner({ cwd, runId, queueRunId: 'q-1' });

		const onDisk: unknown = JSON.parse(readFileSync(join(runDir, 'owner.json'), 'utf8'));

		expect(written).toStrictEqual({ queueRunId: 'q-1' });
		expect(onDisk).toStrictEqual({ queueRunId: 'q-1' });
	});

	test.each([
		{ withReport: true, queueRunId: undefined },
		{ withReport: true, queueRunId: 'q-1' },
		{ withReport: false, queueRunId: undefined },
	])("removes the run's saved final report so a new attempt never shows an earlier one", async ({ withReport, queueRunId }) => {
		const { cwd, runId, runDir } = setupRunWithReport({ withReport });

		const written = await writeRunOwner({ cwd, runId, ...(queueRunId === undefined ? {} : { queueRunId }) });

		const readBack = await readRunOwner({ cwd, runId });
		const files = readdirSync(runDir);

		expect({ files, readBack }).toEqual({ files: ['owner.json'], readBack: written });
	});
});
