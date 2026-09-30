import { LinearClient } from '@linear/sdk';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { TrackerFailure } from '#src/ticketTracker/common/types/TrackerFailure.ts';
import { trackerTimeoutMs } from '#src/ticketTracker/internal/common/constants/trackerTimeoutMs.ts';

interface Params<Result> {
	apiKey: string;
	call: (client: LinearClient) => Promise<Result>;
}

/**
 * Deliberately absent from the barrel, so swapping trackers stays a change
 * inside this folder. Every failure, deadline included, comes back as a
 * `TrackerFailure` value rather than an exception.
 */
export const runLinear = async <Result>({ apiKey, call }: Params<Result>): Promise<Result | TrackerFailure> => {
	let timer: NodeJS.Timeout | undefined;

	try {
		const deadline = new Promise<never>((_resolve, reject) => {
			timer = setTimeout(() => reject(new Error(`the tracker did not answer within ${trackerTimeoutMs}ms`)), trackerTimeoutMs);
		});

		return await Promise.race([call(new LinearClient({ apiKey })), deadline]);
	} catch (error) {
		return { error: messageOf({ error }) };
	} finally {
		clearTimeout(timer);
	}
};
