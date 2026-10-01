import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { QueueDrainReport } from '#src/queue/common/types/QueueDrainReport.ts';
import type { ParkedWork } from '#src/queue/internal/common/types/ParkedWork.ts';
import type { WaveSelection } from '#src/queue/internal/common/types/WaveSelection.ts';
import { startCoordinatorRun } from '#src/queue/internal/common/utils/startCoordinatorRun.ts';
import { toCoordinatorStatus } from '#src/queue/internal/common/utils/toCoordinatorStatus.ts';
import { withRunLock } from '#src/runState/lock/withRunLock.ts';
import { seedUsageTotals } from '#src/runState/seedUsageTotals.ts';
import { writeManifestWithUsage } from '#src/runState/writeManifestWithUsage.ts';

interface Params {
	cwd: string;
	runId: string | undefined;
	recordEmptyDrain: boolean | undefined;
	driverName: string;
	config: LightsoutConfig;
	first: WaveSelection;
	parked: ParkedWork;
	onProgress?: (message: string) => void;
}

/**
 * Narrates a drain with nothing to do and answers its report. Recorded, the
 * queue run is created and settled at once, under the same id and lock a drain
 * takes; otherwise no run is created.
 *
 * @param recordEmptyDrain - true when a detached queue's child must leave a run for the launcher's handshake and the saved summary
 */
export const settleEmptyDrain = async ({ cwd, runId, recordEmptyDrain, driverName, config, first, parked, onProgress }: Params): Promise<QueueDrainReport> => {
	onProgress?.(
		first.blocked.length > 0
			? 'nothing to do — every eligible ticket is waiting on an unfinished blocker'
			: 'nothing to do — no eligible tickets, and no parked worktrees to pick up',
	);

	const empty: QueueDrainReport = { outcomes: [], leftBehind: [...parked.leftBehind, ...first.skipped, ...first.blocked] };

	if (recordEmptyDrain !== true) {
		return empty;
	}

	return withRunLock({
		params: { cwd, runId, onProgress },
		run: async ({ runId: lockedRunId }) => {
			const { manifest } = await startCoordinatorRun({ cwd, runId: lockedRunId, driverName, config });

			await writeManifestWithUsage({
				cwd,
				manifest,
				patch: { status: toCoordinatorStatus({ drained: empty }), currentStep: null },
				usageTotals: seedUsageTotals({ usage: manifest.usage }),
			});

			return empty;
		},
	});
};
