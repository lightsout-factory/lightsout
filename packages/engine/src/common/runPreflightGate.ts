import { describeGateNoVerdict } from '#src/common/describeGateNoVerdict.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { runGates } from '#src/gates/runGates/runGates.ts';

/**
 * The slice of a run this gate touches, structural on purpose: a coverage run
 * and a refactor run share no declared type, and the gate needs nothing of
 * either beyond what `stop` hands back.
 */
interface GatedRun<TResult> {
	cwd: string;
	config: LightsoutConfig;
	current(): RunManifest;
	progress(message: string): void;
	setStep(params: { record: StepRecord; patch?: Partial<RunManifest> }): Promise<void>;
	stop(params: { record: StepRecord; status: RunStatus; error: string }): Promise<TResult>;
}

interface Params<TResult> {
	run: GatedRun<TResult>;
	/** Also run the coverage gate — off for a run whose coverage gate is red by definition. */
	coverage: boolean;
	label: string;
	/** Sentence put in front of the gate output when the baseline is red. */
	redBaselineError: string;
}

/**
 * The consumer's own gates before any agent spend: a red gate after a batch
 * can only mean "the batch's doing" if the baseline was green. A baseline that
 * returned no verdict records no passed step, so a later attempt runs it again
 * rather than inheriting a proof nothing established.
 *
 * @returns the run-ending result when the baseline is red or returned no verdict, undefined to proceed
 */
export const runPreflightGate = async <TResult>({ run, coverage, label, redBaselineError }: Params<TResult>): Promise<TResult | undefined> => {
	const steps = run.current().steps;

	if (steps.some((step) => step.id === 'pre-flight' && step.status === RunStatus.Passed)) {
		return undefined;
	}

	const record: StepRecord = {
		id: 'pre-flight',
		status: RunStatus.Running,
		attempts: (steps.find((step) => step.id === 'pre-flight')?.attempts ?? 0) + 1,
	};

	await run.setStep({ record });
	run.progress(label);

	const gates = await runGates({
		cwd: run.cwd,
		config: run.config,
		coverage,
		runId: run.current().runId,
		step: 'pre-flight',
		onProgress: (message) => run.progress(message),
	});

	const noVerdict = describeGateNoVerdict({ result: gates });
	let result: TResult | undefined;

	if (noVerdict !== undefined) {
		// The baseline was neither proved nor disproved, so the red-baseline
		// sentence would assert something no command established.
		result = await run.stop({ record, status: RunStatus.Escalated, error: noVerdict });
	} else if (gates.error) {
		result = await run.stop({ record, status: RunStatus.Failed, error: `${redBaselineError}\n${gates.error}` });
	} else {
		await run.setStep({ record: { ...record, status: RunStatus.Passed } });
	}

	return result;
};
