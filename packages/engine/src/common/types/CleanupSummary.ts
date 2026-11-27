import type { CleanupEndReason } from '#src/contracts/run/CleanupEndReason.ts';

export interface CleanupSummary {
	/** Cleanup executor rounds actually spent; 0 when no executor was invoked. */
	rounds: number;
	/** Why cleanup ended, exactly as the step recorded it; undefined while cleanup is still running or parked mid-loop. */
	endReason: CleanupEndReason | undefined;
	/** Deterministic blocking findings this run introduced or measurably worsened that still stand. */
	remainingFindings: number;
	/** Findings recorded but never handed to the executor: inherited debt and findings whose provenance could not be established. */
	carriedFindings: number;
	/** Judgment-review findings from the review that observed the final edits. */
	reviewFindings: number;
	/** Cleanup-agent attempts that timed out or returned nothing usable. */
	failures: number;
	/** Blocking findings cleanup rounds were handed; undefined on a record that predates `targeted`. */
	targetedFindings: number | undefined;
	/** Of those, the ones whose `siteKey` no remaining finding carries; undefined with `targetedFindings`. */
	fixedFindings: number | undefined;
	/** Each targeted finding whose `siteKey` no remaining finding carries, as its rule and files, in first-handed order; empty on a record that predates `targeted`. */
	fixedSites: { rule: string; files: string[] }[];
	/** Each remaining finding's rule and files, in recorded order. */
	remainingSites: { rule: string; files: string[] }[];
}
