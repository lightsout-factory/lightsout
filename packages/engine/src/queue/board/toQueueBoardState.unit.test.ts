import { describe, expect, test } from '@jest/globals';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';
import { toQueueBoardState } from '#src/queue/board/toQueueBoardState.ts';

/** A queue coordinator's row in the runs list for each status and liveness a case names, in the order the expectation lists them. */
const setupListings = () => {
	const listingOf = ({ status, live }: { status: RunStatus; live: boolean }): RunListing => ({
		runId: 'run-queue-0001',
		shortId: 'run-queu',
		pipeline: PipelineKind.Queue,
		status,
		title: 'queue',
		plan: '',
		createdAt: '2026-09-10T08:00:00.000Z',
		updatedAt: '2026-09-10T08:10:00.000Z',
		live,
		packages: [],
		stepsPassed: 0,
		stepCount: 0,
		changedFileCount: 0,
		resumable: false,
	});
	const listings = [
		listingOf({ status: RunStatus.Running, live: true }),
		listingOf({ status: RunStatus.Pending, live: true }),
		listingOf({ status: RunStatus.Running, live: false }),
		listingOf({ status: RunStatus.Pending, live: false }),
		listingOf({ status: RunStatus.Passed, live: true }),
		listingOf({ status: RunStatus.Passed, live: false }),
		listingOf({ status: RunStatus.Failed, live: true }),
		listingOf({ status: RunStatus.Failed, live: false }),
	];

	return { listings };
};

describe('toQueueBoardState', () => {
	test('a going queue run is live or stopped by its process, and any other status is finished', () => {
		const { listings } = setupListings();

		const states = listings.map((listing) => toQueueBoardState({ listing }));

		expect(states).toEqual(['live', 'live', 'stopped', 'stopped', 'finished', 'finished', 'finished', 'finished']);
	});
});
