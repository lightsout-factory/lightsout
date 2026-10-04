import { join } from 'node:path';
import { getCommandRunsDir } from '#src/common/getCommandRunsDir.ts';
import { getWorkOrderRunsDir } from '#src/common/getWorkOrderRunsDir.ts';
import { workOrderNameOf } from '#src/common/planAddress/workOrderNameOf.ts';
import { resolveSharedStateDir } from '#src/common/workspace/resolveSharedStateDir.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';

interface Params {
	cwd: string;
	/** The plan this run belongs to: an address `<work-order>/<plan-id>`. Absent on a run that belongs to no plan. */
	planName?: string;
	/** The ticket branch a plan-less run is built on. Absent on a run with no ticket to file under either. */
	workOrderName?: string;
	/** The pipeline that owns the run. An absent one reads as implement, matching what an absent discriminator already means on a manifest. */
	pipeline?: PipelineKind;
	runId: string;
}

/**
 * A plan name wins if both arrive, because a plan's address names its ticket
 * too — the two inputs can never disagree. It creates nothing: whoever writes
 * into a run folder creates it.
 */
export const resolveNewRunDir = async ({ cwd, planName, workOrderName, pipeline, runId }: Params): Promise<string> => {
	const ticket = planName === undefined ? workOrderName : workOrderNameOf({ name: planName });
	const runsDir =
		ticket === undefined
			? getCommandRunsDir({ stateDir: await resolveSharedStateDir({ cwd }), pipeline: pipeline ?? PipelineKind.Implement })
			: getWorkOrderRunsDir({ workOrderFolder: await workOrderFolderDir({ cwd, name: ticket }) });

	return join(runsDir, runId);
};
