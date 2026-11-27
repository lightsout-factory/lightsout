import { formatPlanAddress } from '#src/common/planAddress/formatPlanAddress.ts';
import type { EvidenceCount } from '#src/contracts/views/planEvidence/EvidenceCount.ts';
import type { EvidenceHeadline } from '#src/contracts/views/planEvidence/EvidenceHeadline.ts';
import type { PlanEvidence } from '#src/contracts/views/planEvidence/PlanEvidence.ts';
import type { WorkOrderEvidenceTotals } from '#src/contracts/views/workOrder/WorkOrderEvidenceTotals.ts';
import { measuredCount } from '#src/views/common/measuredCount.ts';
import { getPlanEvidence } from '#src/views/getPlanEvidence/getPlanEvidence.ts';
import { getWorkOrderView } from '#src/views/getWorkOrderView.ts';
import { PlanWorkspaceNotFoundError } from '#src/views/PlanWorkspaceNotFoundError.ts';

interface Params {
	cwd: string;
	/** The folder's name under the work-orders directory. */
	name: string;
}

/** A plan has evidence once its activity started or any section was recorded. */
const hasEvidence = ({ evidence }: { evidence: PlanEvidence }) => {
	const sections = [evidence.plan, evidence.tests, evidence.checks, evidence.cleanup, evidence.agents, evidence.ship];

	return evidence.headline.startedAt !== undefined || sections.some((section) => section !== undefined);
};

/** Absent when no covered plan carries the figure, so a total never reads as a measured zero. */
const sumCounts = ({ counts }: { counts: (EvidenceCount | undefined)[] }) => {
	const present = counts.filter((count) => count !== undefined);

	return present.length === 0 ? undefined : measuredCount({ value: present.reduce((total, count) => total + count.value, 0) });
};

/** The merge belongs to the branch, so every covered plan carries the same one. */
const totalHeadlines = ({ headlines }: { headlines: EvidenceHeadline[] }): EvidenceHeadline => ({
	startedAt: headlines
		.flatMap((headline) => (headline.startedAt === undefined ? [] : [headline.startedAt]))
		.sort((left, right) => Date.parse(left) - Date.parse(right))
		.at(0),
	mergedAt: headlines.at(0)?.mergedAt,
	questionsAsked: sumCounts({ counts: headlines.map((headline) => headline.questionsAsked) }),
	recordedCostUsd: sumCounts({ counts: headlines.map((headline) => headline.recordedCostUsd) }),
	findingsFixed: sumCounts({ counts: headlines.map((headline) => headline.findingsFixed) }),
});

/**
 * Totals over the plans that have evidence, stating how many of the work order's counted
 * plans they cover; an excluded plan is left out of both.
 *
 * @returns The totals, or `undefined` when no work-order folder has that name or the folder holds no record.
 * @throws {Error} When the work order's record is on disk and will not parse.
 */
export const getWorkOrderEvidence = async ({ cwd, name }: Params): Promise<WorkOrderEvidenceTotals | undefined> => {
	const view = await getWorkOrderView({ cwd, name });

	if (view === undefined) {
		return undefined;
	}

	const counted = view.plans.filter((plan) => plan.exclusion === undefined);
	const covered: { planId: string; evidence: PlanEvidence }[] = [];

	// One at a time: each plan's evidence reads its own large records.
	for (const plan of counted) {
		try {
			const evidence = await getPlanEvidence({ cwd, name: formatPlanAddress({ workOrderName: name, planId: plan.id }) });

			if (hasEvidence({ evidence })) {
				covered.push({ planId: plan.id, evidence });
			}
		} catch (error) {
			if (!(error instanceof PlanWorkspaceNotFoundError)) {
				throw error;
			}
		}
	}

	return {
		headline: totalHeadlines({ headlines: covered.map(({ evidence }) => evidence.headline) }),
		plansCovered: covered.length,
		plansCounted: counted.length,
		problems: covered.flatMap(({ planId, evidence }) => evidence.problems.map((problem) => `${planId}: ${problem}`)),
	};
};
