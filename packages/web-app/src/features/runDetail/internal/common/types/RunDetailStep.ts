import type { RunStepView } from '@lightsout/engine';

/**
 * The report narrows from `unknown` to `object` because a server function's
 * result must be provably serializable, and the framework refuses to carry `unknown`.
 */
export interface RunDetailStep extends Omit<RunStepView, 'report'> {
	report?: object;
}
