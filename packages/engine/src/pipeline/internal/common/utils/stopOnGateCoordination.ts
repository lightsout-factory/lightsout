import { describeGateCoordinationStop } from '#src/common/describeGateCoordinationStop.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { takeGateHold } from '#src/gates/gateHolds/takeGateHold.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { readWorkOrderTicketRef } from '#src/workOrder/readWorkOrderTicketRef.ts';

interface Params {
	run: PipelineRun;
	stepId: string;
	record: StepRecord;
	/** The coordination reason `runGates` answered with — who holds the machine, in which worktree, and for how long it has held it. */
	coordination: string;
	/** Whatever gate output arrived beside it, kept as evidence a human reads. */
	error: string | undefined;
}

/**
 * Not one gate command executed, so no fix attempt is spent and no supervisor
 * is bought; the step stops rather than passes because a checkpoint that never
 * ran is not a green one. Ticket-backed work also takes the durable hold, or
 * the next drain or `lightsout resume` would queue behind the same busy machine
 * again. A hold failure is folded into the stop so a tracker that refused the
 * label stays visible.
 */
export const stopOnGateCoordination = async ({ run, stepId, record, coordination, error }: Params): Promise<PipelineResult> => {
	run.progress(`step ${stepId}: the gates never started — another run holds this machine, and no fix was attempted`);

	const ticketRef = await readWorkOrderTicketRef({ cwd: run.cwd });
	const holdFailure =
		ticketRef === undefined
			? undefined
			: await takeGateHold({
					cwd: run.cwd,
					config: run.config,
					ticketRef,
					runId: run.current().runId,
					worktreePath: run.cwd,
					reason: coordination,
					onProgress: (message) => run.progress(message),
				});

	return run.stop({
		record,
		status: RunStatus.Escalated,
		error: [describeGateCoordinationStop({ stepId, coordination }), error ?? '', ...(holdFailure === undefined ? [] : [holdFailure])].join('\n\n'),
	});
};
