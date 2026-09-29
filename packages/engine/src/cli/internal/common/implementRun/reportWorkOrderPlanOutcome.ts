import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import type { WorkOrderPlanOutcome } from '#src/workOrder/common/types/WorkOrderPlanOutcome.ts';

interface Params {
	outcome: WorkOrderPlanOutcome;
}

/**
 * A refusal means nothing ran; a record write that did not take is an error
 * beside a run that did happen; and a note (a pass that covered only part of
 * the plan) is news rather than a failure.
 */
export const reportWorkOrderPlanOutcome = ({ outcome }: Params): PipelineResult | undefined => {
	if ('refusal' in outcome) {
		console.error(outcome.refusal);

		return undefined;
	}

	if (outcome.recordError !== undefined) {
		console.error(outcome.recordError);
	}

	if (outcome.note !== undefined) {
		console.log(outcome.note);
	}

	return outcome.result;
};
