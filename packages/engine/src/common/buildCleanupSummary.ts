import type { CleanupSummary } from '#src/common/types/CleanupSummary.ts';
import { RefactorStepReport } from '#src/contracts/run/RefactorStepReport.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';

interface Params {
	step: StepRecord;
}

const toSite = ({ finding }: { finding: StandardsFinding }) => ({ rule: finding.rule, files: finding.files.map((file) => file.path) });

/**
 * The contract decides, never the step id. A step with no cleanup report
 * answers undefined rather than a zeroed summary, which would read as a pass
 * that ran and found nothing.
 */
export const buildCleanupSummary = ({ step }: Params): CleanupSummary | undefined => {
	const parsed = RefactorStepReport.safeParse(step.report);
	let summary: CleanupSummary | undefined;

	if (parsed.success) {
		const { roundsUsed, endReason, remaining, inherited, uncertain, targeted, finalReview, failures } = parsed.data;
		// Matched by site, never by object: a finding still standing may carry a new detail.
		const standing = new Set(remaining.map((finding) => finding.siteKey));
		const fixed = targeted?.filter((finding) => !standing.has(finding.siteKey));

		summary = {
			rounds: roundsUsed,
			endReason,
			remainingFindings: remaining.length,
			carriedFindings: inherited.length + uncertain.length,
			reviewFindings: finalReview.length,
			failures: failures.length,
			targetedFindings: targeted?.length,
			fixedFindings: fixed?.length,
			fixedSites: (fixed ?? []).map((finding) => toSite({ finding })),
			remainingSites: remaining.map((finding) => toSite({ finding })),
		};
	}

	return summary;
};
