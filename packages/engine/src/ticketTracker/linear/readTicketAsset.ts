import { messageOf } from '#src/common/messageOf.ts';
import type { TrackerFailure } from '#src/common/types/TrackerFailure.ts';
import type { LinearTrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { trackerTimeoutMs } from '#src/ticketTracker/common/constants/trackerTimeoutMs.ts';

interface Params {
	settings: LinearTrackerSettings;
	/** A `TrackerAttachment.url`. */
	url: string;
}

/**
 * An uploaded asset is not public, so the request carries the API key; that is
 * why this lives in the tracker module. Not `runLinear`, since this is no
 * GraphQL call, but it keeps the same deadline and returned-failure contract.
 */
export const readTicketAsset = async ({ settings, url }: Params): Promise<string | TrackerFailure> => {
	try {
		const assetUrl = new URL(url);

		if (assetUrl.origin !== 'https://uploads.linear.app') {
			return { error: `refusing to send tracker credentials to untrusted attachment URL '${url}'` };
		}

		// No `Bearer` prefix: a Linear personal API key is sent bare, as the SDK does.
		const response = await fetch(url, { headers: { Authorization: settings.apiKey }, signal: AbortSignal.timeout(trackerTimeoutMs) });

		return response.ok ? await response.text() : { error: `the tracker refused ${url}: HTTP ${response.status}` };
	} catch (error) {
		return { error: messageOf({ error }) };
	}
};
