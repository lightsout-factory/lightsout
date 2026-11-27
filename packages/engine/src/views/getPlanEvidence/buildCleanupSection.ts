import type { CleanupSummary } from '#src/common/types/CleanupSummary.ts';
import type { DedupReport } from '#src/contracts/dedup/DedupReport.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { EvidenceProvenance } from '#src/contracts/views/planEvidence/EvidenceProvenance.ts';
import { EvidenceSectionState } from '#src/contracts/views/planEvidence/EvidenceSectionState.ts';
import type { PlanEvidence } from '#src/contracts/views/planEvidence/PlanEvidence.ts';
import { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { measuredCount } from '#src/views/common/measuredCount.ts';
import { reportedCount } from '#src/views/getPlanEvidence/common/reportedCount.ts';
import type { BuildRun } from '#src/views/getPlanEvidence/common/types/BuildRun.ts';

interface Params {
	runs: BuildRun[];
	/** `workspace.dedup`. */
	dedup: DedupReport | undefined;
	/** The build run is running, pending or paused. */
	going: boolean;
}

type StandardsPart = NonNullable<NonNullable<PlanEvidence['cleanup']>['standards']>;

/** The cleanup step's own figures, summed across every record the family holds; found and fixed only where `targeted` was recorded. */
const buildStandardsPart = ({ cleanups }: { cleanups: CleanupSummary[] }): StandardsPart => {
	const recorded = cleanups.flatMap((cleanup) => (cleanup.targetedFindings === undefined ? [] : [cleanup.targetedFindings]));

	return {
		state: cleanups.some((cleanup) => cleanup.endReason === undefined) ? EvidenceSectionState.InProgress : EvidenceSectionState.Finished,
		found: recorded.length === 0 ? undefined : measuredCount({ value: recorded.reduce((total, count) => total + count, 0) }),
		fixed: cleanups.flatMap((cleanup) => cleanup.fixedSites.map((site) => ({ ...site, provenance: EvidenceProvenance.Measured }))),
		remaining: cleanups.flatMap((cleanup) => cleanup.remainingSites.map((site) => ({ ...site, provenance: EvidenceProvenance.Measured }))),
		carried: measuredCount({ value: cleanups.reduce((total, cleanup) => total + cleanup.carriedFindings, 0) }),
		reviewFindings: reportedCount({ value: cleanups.reduce((total, cleanup) => total + cleanup.reviewFindings, 0) }),
	};
};

/** One step's prior-art searches, misses kept, as its executor reported them. */
const searchesOf = ({ step }: { step: StepRecord }) => {
	const priorArt = WorkReport.safeParse(step.report).data?.priorArt ?? [];

	return priorArt.map(({ symbol, searches, matches }) => ({ symbol, searches, matches, provenance: EvidenceProvenance.Reported }));
};

/**
 * A search is what an executor said it ran and found, so it is reported, misses included.
 * Absent when the family has no cleanup record, no search and no duplicate.
 */
export const buildCleanupSection = ({ runs, dedup, going }: Params): PlanEvidence['cleanup'] => {
	const cleanups = runs.flatMap((run) => (run.summary.cleanup === undefined ? [] : [run.summary.cleanup]));
	const searches = runs.flatMap((run) => run.manifest.steps.flatMap((step) => searchesOf({ step })));
	const duplicates = dedup?.findings.length ?? 0;

	if (cleanups.length === 0 && searches.length === 0 && duplicates === 0) {
		return undefined;
	}

	const standards = cleanups.length === 0 ? undefined : buildStandardsPart({ cleanups });

	return {
		state: going || standards?.state === EvidenceSectionState.InProgress ? EvidenceSectionState.InProgress : EvidenceSectionState.Finished,
		standards,
		searches,
		duplicates: duplicates === 0 ? undefined : reportedCount({ value: duplicates }),
	};
};
