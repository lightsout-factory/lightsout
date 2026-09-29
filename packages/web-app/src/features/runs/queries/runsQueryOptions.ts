import { RunStatus } from '@lightsout/engine/contracts';
import { queryOptions } from '@tanstack/react-query';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { listRunsServerFn } from '#src/features/runs/serverFns/listRuns/listRunsServerFn.ts';

/** Polls only while a run is in flight, so a viewer left open on a finished repo costs nothing. */
export const runsQueryOptions = () =>
	queryOptions({
		queryKey: [QueryKey.Runs],
		queryFn: () => listRunsServerFn(),
		refetchInterval: (query) => (query.state.data?.some((run) => run.status === RunStatus.Running) ? 3_000 : false),
	});
