import type { BatchOutcome } from '#src/contracts/refactor/BatchOutcome.ts';
import type { BatchReport } from '#src/contracts/refactor/BatchReport.ts';
import type { AdvisoryOutcome } from '#src/contracts/standardsCheck/AdvisoryOutcome.ts';
import type { BatchStop } from '#src/refactor/internal/common/types/BatchStop.ts';

/**
 * The stores are exposed because the invocation path writes them while the
 * reporting side reads them; one owner keeps the two accounts from disagreeing.
 */
export interface BatchRecorder {
	rationale: string[];
	/** Fix invocations included. */
	reportedFiles: Set<string>;
	/** Keyed by site. */
	advisoryOutcomes: Map<string, AdvisoryOutcome>;
	/** The batch's report as it stands, without ending the batch. */
	reportOf: (params: { outcome: BatchOutcome; remainingSiteKeys: string[] }) => BatchReport;
	/** Agents' reports unioned with git truth. */
	changedFiles: () => Promise<string[]>;
	/** Merges git truth into the files the batch claims. */
	finish: (params: { outcome: BatchOutcome; remainingSiteKeys: string[] }) => Promise<BatchStop>;
}
