import { EvidenceSectionState, type PlanEvidence } from '@lightsout/engine/contracts';
import { queryOptions } from '@tanstack/react-query';
import { getPlanEvidenceServerFn } from '#src/features/workOrders/server/getPlanEvidenceServerFn.ts';
import { pollWhileLive } from '#src/utils/pollWhileLive.ts';

interface Params {
	/** The work order's folder name. */
	workOrder: string;
	/** The plan's id within it. */
	plan: string;
}

/** Any present section is still being written. */
const isEvidenceInProgress = ({ evidence }: { evidence: PlanEvidence | undefined }) => {
	const sections = evidence === undefined ? [] : [evidence.plan, evidence.tests, evidence.checks, evidence.cleanup, evidence.agents, evidence.ship];

	return sections.some((section) => section?.state === EvidenceSectionState.InProgress);
};

/**
 * The summary reads large records, so it is fetched when its tab opens and polled every thirty
 * seconds only while a section is in progress, far slower than the plan page's own poll.
 */
export const planEvidenceQueryOptions = ({ workOrder, plan }: Params) =>
	queryOptions({
		queryKey: ['planEvidence', workOrder, plan],
		queryFn: () => getPlanEvidenceServerFn({ data: { name: `${workOrder}/${plan}` } }),
		refetchInterval: (query) => pollWhileLive({ live: isEvidenceInProgress({ evidence: query.state.data }), intervalMs: 30_000 }),
	});
