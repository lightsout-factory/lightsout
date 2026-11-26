import { describe, expect, test } from '@jest/globals';
import { QueueBoardState, type QueueView } from '@lightsout/engine';
import { queueViewQueryOptions } from '#src/features/queue/queries/queueViewQueryOptions.ts';

// The slice of TanStack's Query the interval reads: the cached view, if any.
interface PolledQuery {
	state: { data?: QueueView };
}

const drainQuery = ({ state }: { state: QueueBoardState }): PolledQuery => ({
	state: {
		data: {
			drain: { runId: 'queue-run-1', state, at: '2026-11-26T10:00:00.000Z', lanes: [] },
		},
	},
});

// No mocks: the fetcher is never called here, and the interval reads only the
// query handed to it.
const setupQueueViewQueryOptions = () => {
	const options = queueViewQueryOptions();
	// Typed against TanStack's Query generics, of which the interval reads only
	// the cached data.
	const refetchInterval = options.refetchInterval as unknown as (query: PolledQuery) => number | false;
	const liveQuery = drainQuery({ state: QueueBoardState.Live });
	const stoppedQuery = drainQuery({ state: QueueBoardState.Stopped });
	const finishedQuery = drainQuery({ state: QueueBoardState.Finished });
	const noDrainQuery: PolledQuery = { state: { data: {} } };
	const unloadedQuery: PolledQuery = { state: {} };

	return { finishedQuery, liveQuery, noDrainQuery, options, refetchInterval, stoppedQuery, unloadedQuery };
};

describe('queueViewQueryOptions', () => {
	test('polls only while the drain is live', () => {
		const { finishedQuery, liveQuery, noDrainQuery, options, refetchInterval, stoppedQuery, unloadedQuery } = setupQueueViewQueryOptions();

		const whileLive = refetchInterval(liveQuery);
		const whileStopped = refetchInterval(stoppedQuery);
		const whileFinished = refetchInterval(finishedQuery);
		const withNoDrain = refetchInterval(noDrainQuery);
		const beforeLoad = refetchInterval(unloadedQuery);

		expect({ queryKey: options.queryKey, whileLive, whileStopped, whileFinished, withNoDrain, beforeLoad }).toStrictEqual({
			queryKey: ['queueView'],
			whileLive: 5000,
			whileStopped: false,
			whileFinished: false,
			withNoDrain: false,
			beforeLoad: false,
		});
	});
});
