import { queryOptions } from '@tanstack/react-query';
import { getPlanWorkspaceServerFn } from '#src/features/workOrders/server/getPlanWorkspaceServerFn.ts';
import { pollWhileLive } from '#src/utils/pollWhileLive.ts';

interface Params {
	/** The work order's folder name. */
	workOrder: string;
	/** The plan's id within it. */
	plan: string;
}

/** The one place the web app spells a plan address. Polled only while planning or one of the plan's runs is live. */
export const planWorkspaceQueryOptions = ({ workOrder, plan }: Params) =>
	queryOptions({
		queryKey: ['planWorkspace', workOrder, plan],
		queryFn: () => getPlanWorkspaceServerFn({ data: { name: `${workOrder}/${plan}` } }),
		refetchInterval: (query) => pollWhileLive({ live: query.state.data?.planningLive === true || query.state.data?.runs.some((run) => run.live) === true }),
	});
