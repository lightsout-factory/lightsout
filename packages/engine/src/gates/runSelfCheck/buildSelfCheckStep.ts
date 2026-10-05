import { selfCheckStepPrefix } from '#src/common/selfCheck/selfCheckStepPrefix.ts';

interface Params {
	/** The pipeline step the self-check was invoked during, e.g. 'implement'. */
	step: string;
}

/**
 * A self-check recorded under the step name itself would land in the following
 * checkpoint's evidence namespace, where that checkpoint reads it back.
 */
export const buildSelfCheckStep = ({ step }: Params): string => `${selfCheckStepPrefix}${step}`;
