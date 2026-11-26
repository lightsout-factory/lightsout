import { QueueBoardState } from '@lightsout/engine/contracts';
import { queryOptions } from '@tanstack/react-query';
import { getQueueViewServerFn } from '#src/features/queue/server/getQueueViewServerFn.ts';
import { pollWhileLive } from '#src/utils/pollWhileLive.ts';

/** Polled only while the drain is live; a stopped or finished drain cannot change. */
export const queueViewQueryOptions = () =>
	queryOptions({
		queryKey: ['queueView'],
		queryFn: () => getQueueViewServerFn(),
		refetchInterval: (query) => pollWhileLive({ live: query.state.data?.drain?.state === QueueBoardState.Live }),
	});
