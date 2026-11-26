import { PlanningStep } from '#src/contracts/plan/progress/PlanningStep.ts';
import type { PlanningStepRecord } from '#src/contracts/plan/progress/PlanningStepRecord.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';

interface Params {
	steps: PlanningStepRecord[];
	/** The running entries whose recording process is alive now; members of `steps`. */
	live: PlanningStepRecord[];
	/** One clock reading, so every duration in a block or a view agrees. */
	nowMs: number;
}

/**
 * A running entry whose recording process is gone is drawn failed with no
 * clock: it can no longer finish, and drawing it running would make a crashed
 * plan look busy.
 */
export const buildPlanningStepRows = ({
	steps,
	live,
	nowMs,
}: Params): { id: PlanningStep; status: RunStatus | undefined; attempts: number; durationMs: number | undefined }[] =>
	Object.values(PlanningStep).map((step) => {
		const entry = steps.find((candidate) => candidate.step === step);

		if (entry === undefined) {
			return { id: step, status: undefined, attempts: 0, durationMs: undefined };
		}

		let status = entry.status;
		let durationMs = entry.durationMs;

		if (entry.status === RunStatus.Running) {
			const isLive = live.includes(entry);

			status = isLive ? RunStatus.Running : RunStatus.Failed;
			durationMs = isLive ? nowMs - Date.parse(entry.startedAt) : undefined;
		}

		return { id: step, status, attempts: entry.attempts, durationMs };
	});
