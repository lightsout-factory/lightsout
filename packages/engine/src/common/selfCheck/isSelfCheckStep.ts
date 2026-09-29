import { selfCheckStepPrefix } from '#src/common/selfCheck/selfCheckStepPrefix.ts';

interface Params {
	/** A command-log row's `step`, absent on records written outside a step. */
	step: string | undefined;
}

/**
 * Kept beside `buildSelfCheckStep`: the gates module writes the name and the run-state
 * module reads it, and the gates module already imports run-state, so the other way is a cycle.
 */
export const isSelfCheckStep = ({ step }: Params): boolean => step?.startsWith(selfCheckStepPrefix) ?? false;
