import { describe, expect, test } from '@jest/globals';
import { recordPassedBatch } from '#src/common/runs/recordPassedBatch.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';

/** A run that has already changed two files, recording every step write it is asked for. */
const setupRun = () => {
	const writes: { record: StepRecord; patch?: Partial<RunManifest> }[] = [];
	const run = {
		current: () => ({ changedFiles: ['src/a.ts', 'src/b.ts'] }),
		setStep: async (write: { record: StepRecord; patch?: Partial<RunManifest> }) => {
			writes.push(write);
		},
	};
	const record: StepRecord = { id: 'batch-01', status: 'running', attempts: 1 };

	return { run, record, writes };
};

describe('recordPassedBatch', () => {
	test('the step is written as passed, carrying its report and the files it changed', async () => {
		const { run, record, writes } = setupRun();

		await recordPassedBatch({ run, record, report: { outcome: 'resolved' }, changedFiles: ['src/c.ts'] });

		expect(writes.map((write) => write.record)).toStrictEqual([
			{ id: 'batch-01', status: 'passed', attempts: 1, report: { outcome: 'resolved' }, changedFiles: ['src/c.ts'] },
		]);
	});

	test("the batch's files join the run's list, and a file already there is not listed twice", async () => {
		const { run, record, writes } = setupRun();

		await recordPassedBatch({ run, record, report: {}, changedFiles: ['src/b.ts', 'src/c.ts'] });

		expect(writes.map((write) => write.patch)).toStrictEqual([{ changedFiles: ['src/a.ts', 'src/b.ts', 'src/c.ts'] }]);
	});
});
