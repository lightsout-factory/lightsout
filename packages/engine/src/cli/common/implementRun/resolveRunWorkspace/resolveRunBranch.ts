import { workOrderNameOf } from '#src/common/planAddress/workOrderNameOf.ts';
import { readWorkOrderRecordFile } from '#src/common/workspace/readWorkOrderRecordFile.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import { planNameFromPath } from '#src/plan/planNameFromPath.ts';
import { findWorkOrderByTicketRef } from '#src/workOrder/findWorkOrderByTicketRef.ts';

interface Params {
	/** The checkout the command was launched from. */
	cwd: string;
	/** `--plan` exactly as the user typed it, for a plan-based run. */
	planPath?: string;
	/** `--ticket` exactly as the user typed it — named in the refusal, never turned into a branch. */
	ticketPath?: string;
	/** `--ref` exactly as the user typed it, when a direct run named one. */
	ticketRef?: string;
}

const branchOfPlan = async ({ cwd, planPath }: { cwd: string; planPath: string }) => {
	const planName = await planNameFromPath({ cwd, planPath });

	if (planName === undefined) {
		return undefined;
	}

	const record = await readWorkOrderRecordFile({ workOrderFolder: await workOrderFolderDir({ cwd, name: workOrderNameOf({ name: planName }) }) });

	return record?.branch;
};

/**
 * The branch comes only from a work order's record, never derived from a file
 * stem or the queue's template: the record exists to be the branch's one
 * author. So an isolated direct run needs a `--ref` whose work order exists.
 */
export const resolveRunBranch = async ({ cwd, planPath, ticketPath, ticketRef }: Params): Promise<string | { error: string }> => {
	let branch: string | undefined;

	if (planPath !== undefined) {
		branch = await branchOfPlan({ cwd, planPath });
	} else if (ticketRef !== undefined) {
		branch = (await findWorkOrderByTicketRef({ cwd, ticketRef }))?.record.branch;
	}

	const named = planPath ?? ticketPath ?? ticketRef ?? '--ref';

	return branch === undefined
		? {
				error: `no branch could be resolved from '${named}' — it names no work order, and only a work order's record says which branch its work implements on, so pass --no-worktree to build in the checkout this was launched from`,
			}
		: branch;
};
