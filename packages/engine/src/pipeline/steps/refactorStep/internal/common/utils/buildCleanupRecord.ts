import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { CleanupContext } from '#src/pipeline/steps/refactorStep/internal/common/types/CleanupContext.ts';
import type { CleanupState } from '#src/pipeline/steps/refactorStep/internal/common/types/CleanupState.ts';

interface Params {
	context: CleanupContext;
	state: CleanupState;
}

/**
 * Composed fresh before every persist, including the record handed to the executor pass, so
 * its writes and its rate-limit park carry the cleanup record and the round count survives a
 * park or a crash.
 */
export const buildCleanupRecord = ({ context, state }: Params): StepRecord => ({
	...state.record,
	report: {
		roundsUsed: state.roundsUsed,
		...(state.endReason === undefined ? {} : { endReason: state.endReason }),
		remaining: state.remaining,
		inherited: state.inherited,
		uncertain: state.uncertain,
		failures: state.failures,
		initialReview: context.initialReview,
		finalReview: state.finalReview,
		...(state.narration === undefined ? {} : { narration: state.narration }),
		...(state.lastReport === undefined ? {} : { lastReport: state.lastReport }),
	},
});
