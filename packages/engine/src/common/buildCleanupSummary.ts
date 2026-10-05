import type { CleanupSummary } from '#src/common/types/CleanupSummary.ts';
import { RefactorStepReport } from '#src/contracts/run/RefactorStepReport.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';

interface Params {
	step: StepRecord;
}

/**
 * The contract decides, never the step id. A step with no cleanup report
 * answers undefined rather than a zeroed summary, which would read as a pass
 * that ran and found nothing.
 */
export const buildCleanupSummary = ({ step }: Params): CleanupSummary | undefined => {
	const parsed = RefactorStepReport.safeParse(step.report);
	let summary: CleanupSummary | undefined;

	if (parsed.success) {
		const { roundsUsed, endReason, remaining, inherited, uncertain, finalReview, failures } = parsed.data;

		summary = {
			rounds: roundsUsed,
			endReason,
			remainingFindings: remaining.length,
			carriedFindings: inherited.length + uncertain.length,
			reviewFindings: finalReview.length,
			failures: failures.length,
		};
	}

	return summary;
};
