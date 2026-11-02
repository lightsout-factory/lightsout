import { RunStatus } from '@lightsout/engine/contracts';
import { queryOptions } from '@tanstack/react-query';
import { getRunServerFn } from '#src/runDetail/server/getRunServerFn/getRunServerFn.ts';

interface Params {
	/** Full run id, or the shortened form a report printed. */
	runId: string;
}

export const runQueryOptions = ({ runId }: Params) =>
	queryOptions({
		queryKey: ['run', runId],
		queryFn: () => getRunServerFn({ data: { runId } }),
		refetchInterval: (query) => (query.state.data?.listing.status === RunStatus.Running ? 3_000 : false),
	});
