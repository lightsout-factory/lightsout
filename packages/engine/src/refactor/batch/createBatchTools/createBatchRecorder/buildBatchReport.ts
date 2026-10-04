import type { BatchOutcome } from '#src/contracts/refactor/BatchOutcome.ts';
import type { BatchReport } from '#src/contracts/refactor/BatchReport.ts';
import type { AdvisoryOutcome } from '#src/contracts/standardsCheck/AdvisoryOutcome.ts';

interface Params {
	outcome: BatchOutcome;
	/** Site keys still present after the batch (empty when resolved). */
	remainingSiteKeys: string[];
	/** Accumulated across the batch's invocations. */
	rationale: string[];
	/** Last answer per site. */
	advisoryOutcomes: AdvisoryOutcome[];
}

/**
 * Assembled in one place so no exit can drop one of the batch's two accounts. An
 * empty advisory account is omitted: no advice shown and no answer given are the
 * same absence.
 */
export const buildBatchReport = ({ outcome, remainingSiteKeys, rationale, advisoryOutcomes }: Params): BatchReport => {
	return { outcome, remainingSiteKeys, rationale, ...(advisoryOutcomes.length > 0 ? { advisoryOutcomes } : {}) };
};
