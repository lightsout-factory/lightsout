import type { ShippingProgressReading } from '#src/common/types/ShippingProgressReading.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { ShippingStepId } from '#src/contracts/ship/ShippingStepId.ts';

interface Params {
	/** The ship-progress record, or nothing when none is on disk. */
	progress: ShippingProgressReading['progress'];
	/** Whether the process recording this ship is alive now. */
	live: boolean;
	/** One clock reading, so every duration in a block or a view agrees. */
	nowMs: number;
}

/**
 * A running step in a record whose process is gone is drawn failed with no
 * clock: it can no longer finish, and drawing it running would make a crashed
 * ship look busy.
 */
export const buildShippingStepRows = ({
	progress,
	live,
	nowMs,
}: Params): { id: ShippingStepId; status: RunStatus | undefined; attempts: number; durationMs: number | undefined }[] =>
	Object.values(ShippingStepId).map((id) => {
		const step = progress?.steps.find((candidate) => candidate.id === id);

		if (step === undefined || step.status === RunStatus.Pending) {
			return { id, status: undefined, attempts: 0, durationMs: undefined };
		}

		let status = step.status;
		let durationMs = step.durationMs;

		if (step.status === RunStatus.Running) {
			status = live ? RunStatus.Running : RunStatus.Failed;
			durationMs = live && step.startedAt !== undefined ? nowMs - Date.parse(step.startedAt) : undefined;
		}

		return { id, status, attempts: 1, durationMs };
	});
