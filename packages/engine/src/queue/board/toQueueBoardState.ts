import { QueueBoardState } from '#src/contracts/queue/QueueBoardState.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';

interface Params {
	listing: RunListing;
}

/** A going queue run is live or stopped by its process; any other status is finished. */
export const toQueueBoardState = ({ listing }: Params): QueueBoardState => {
	const going = listing.status === RunStatus.Running || listing.status === RunStatus.Pending;
	let state: QueueBoardState = QueueBoardState.Finished;

	if (going) {
		state = listing.live ? QueueBoardState.Live : QueueBoardState.Stopped;
	}

	return state;
};
