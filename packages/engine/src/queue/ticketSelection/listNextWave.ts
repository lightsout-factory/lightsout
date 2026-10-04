import type { GateHolds } from '#src/common/types/GateHolds.ts';
import type { QueueSettings } from '#src/common/types/QueueSettings.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import type { WaveSelection } from '#src/queue/common/types/WaveSelection.ts';
import { listEligibleTickets } from '#src/queue/ticketSelection/listEligibleTickets.ts';
import { orderTickets } from '#src/queue/ticketSelection/orderTickets.ts';
import { selectWaveTickets } from '#src/queue/ticketSelection/selectWaveTickets/selectWaveTickets.ts';

interface Params {
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
	/** Lower-cased identifiers this invocation has already offered to a wave. */
	attempted: Set<string>;
	/** The holds the drain reconciled at its start, forwarded unchanged. */
	holds: GateHolds;
	onProgress?: (message: string) => void;
}

/**
 * Parked worktrees are deliberately not re-scanned; that happens once, before the
 * first wave. Holds are not re-reconciled either: a hold taken during this drain
 * belongs to a ticket never re-offered, and re-reading would put a tracker round
 * trip inside the idle-scan loop.
 */
export const listNextWave = async ({ settings, trackerSettings, attempted, holds, onProgress }: Params): Promise<WaveSelection | QueueFailure> => {
	const eligible = await listEligibleTickets({ settings, trackerSettings });

	if ('error' in eligible) {
		return eligible;
	}

	return selectWaveTickets({ tickets: orderTickets({ tickets: eligible }), settings, attempted, holds, onProgress });
};
