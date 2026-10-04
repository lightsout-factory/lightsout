import type { RunState } from '#src/common/RunState.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { nextStepRecord } from '#src/direct/runDirectWork/common/nextStepRecord.ts';
import { runGates } from '#src/gates/runGates.ts';

const verifyStep = 'verify';

interface Params {
	run: RunState;
}

/**
 * `crashes`, `timeouts` and `coordination` are passed on rather than folded
 * into `gateError` because each asks something different of the caller: only
 * a red gate is evidence to repair.
 */
export const verifyDirectWork = async ({
	run,
}: Params): Promise<{ record: StepRecord; gateError: string | undefined; crashes: string[]; timeouts: string[]; coordination: string | undefined }> => {
	const record = nextStepRecord({ run, id: verifyStep });

	await run.setStep({ record });

	const {
		error: gateError,
		crashes,
		timeouts,
		coordination,
	} = await runGates({
		cwd: run.cwd,
		config: run.config,
		coverage: true,
		runId: run.current().runId,
		step: verifyStep,
		onProgress: (message) => run.progress(message),
	});

	await run.setStep({ record: { ...record, status: gateError ? RunStatus.Failed : RunStatus.Passed, error: gateError } });

	return { record, gateError, crashes, timeouts, coordination };
};
