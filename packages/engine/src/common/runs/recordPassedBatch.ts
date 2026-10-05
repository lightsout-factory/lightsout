import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';

interface Params {
	/** The run the batch belongs to; only what this needs of it. */
	run: {
		current(): Pick<RunManifest, 'changedFiles'>;
		setStep(params: { record: StepRecord; patch?: Partial<RunManifest> }): Promise<void>;
	};
	record: StepRecord;
	report: StepRecord['report'];
	/** The files the batch changed; they join the run's own list, each path once. */
	changedFiles: string[];
}

/** Writes a finished batch as a passed step, whatever its report says: a declined batch passed too. */
export const recordPassedBatch = async ({ run, record, report, changedFiles }: Params): Promise<void> => {
	await run.setStep({
		record: { ...record, status: RunStatus.Passed, report, changedFiles },
		patch: { changedFiles: [...new Set([...run.current().changedFiles, ...changedFiles])] },
	});
};
