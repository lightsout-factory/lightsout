import { relative, sep } from 'node:path';
import { formatPlanAddress } from '#src/common/planAddress/formatPlanAddress.ts';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress/parsePlanAddress.ts';
import { workOrdersDir } from '#src/common/workspace/workOrdersDir.ts';
import { resolveRecordedPlanPath } from '#src/plan/common/paths/resolveRecordedPlanPath.ts';

interface Params {
	cwd: string;
	/** The --plan value exactly as the user gave it. */
	planPath: string;
}

/**
 * The value resolves through `resolveRecordedPlanPath`, so a path handed from a
 * linked worktree is rooted where `workOrdersDir` answers; rooting the two
 * differently would read every such path as no plan at all.
 *
 * The address is spelled with `/` on every platform, because it is the `--name`
 * value plan subcommands take. A path under a ticket's `runs/` folder, or the
 * ticket folder itself, answers undefined rather than the ticket's name: a run
 * manifest records this answer, and a run that belongs to no plan must say so.
 */
export const planNameFromPath = async ({ cwd, planPath }: Params): Promise<string | undefined> => {
	const fromTicketsDir = relative(await workOrdersDir({ cwd }), await resolveRecordedPlanPath({ cwd, path: planPath }));
	const [workOrderName, folder, planId] = fromTicketsDir.split(sep);

	// `relative` walks up with `..` segments, and answers an absolute path
	// outright across a Windows drive change — whose first segment is '' here.
	if (workOrderName === undefined || workOrderName === '' || workOrderName === '..' || folder !== 'plans') {
		return undefined;
	}

	const address = planId === undefined ? undefined : formatPlanAddress({ workOrderName, planId });

	return address !== undefined && parsePlanAddress({ name: address }) !== undefined ? address : undefined;
};
