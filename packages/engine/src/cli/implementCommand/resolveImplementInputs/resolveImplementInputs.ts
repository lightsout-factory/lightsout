import { resolvePlanTarget } from '#src/cli/implementCommand/common/resolvePlanTarget.ts';
import { ensurePlanWorkspace } from '#src/cli/implementCommand/resolveImplementInputs/ensurePlanWorkspace.ts';
import { usage } from '#src/common/constants/usage.ts';
import { getStringFlag } from '#src/common/getStringFlag.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import type { WorkOrderRunTerms } from '#src/common/types/WorkOrderRunTerms.ts';
import { planNameFromPath } from '#src/plan/planNameFromPath.ts';
import { readWorkOrderRunTerms } from '#src/workOrder/implementRun/readWorkOrderRunTerms.ts';

interface Params {
	flags: CommandContext['flags'];
	/** The checkout the command was launched from. */
	cwd: string;
}

/**
 * Every check reads the launching checkout and runs before a workspace is
 * resolved, so no worktree is cut and no tracker is told the ticket started for
 * a run that is going to be refused.
 */
export const resolveImplementInputs = async ({
	flags,
	cwd,
}: Params): Promise<
	| { error: string }
	| {
			planPath: string;
			overviewPath: string | undefined;
			packages: string[] | undefined;
			startPhase: number | undefined;
			planName: string | undefined;
			shipRequest: WorkOrderRunTerms['shipRequest'];
	  }
> => {
	const planPath = getStringFlag({ flags, name: 'plan' });
	const overviewPath = getStringFlag({ flags, name: 'overview' });
	const packagesFlag = getStringFlag({ flags, name: 'packages' });
	const startPhaseFlag = getStringFlag({ flags, name: 'start-phase' });
	const packages = packagesFlag
		? packagesFlag
				.split(',')
				.map((name) => name.trim())
				.filter(Boolean)
		: undefined;

	if (!planPath) {
		return { error: usage };
	}

	const startPhase = startPhaseFlag === undefined ? undefined : Number.parseInt(startPhaseFlag, 10);

	if (startPhase !== undefined && (!Number.isFinite(startPhase) || startPhase < 1)) {
		return { error: `--start-phase must be a positive integer, got '${startPhaseFlag}'` };
	}

	// The fetch has to have happened before anything asks the disk what shape the
	// plan is.
	const ensured = await ensurePlanWorkspace({ cwd, planPath });

	if (ensured !== undefined) {
		return { error: ensured.error };
	}

	const target = await resolvePlanTarget({ cwd, planPath });

	if ('error' in target) {
		return { error: target.error };
	}

	const phased = 'overviewPath' in target;

	if (phased && overviewPath !== undefined) {
		return { error: '--overview applies to a single-plan run — a plan folder with an overview.md already runs every phase' };
	}

	if (phased && packages !== undefined) {
		return { error: '--packages applies to a single-plan run — every phase of a plan folder reads its own scope' };
	}

	if (!phased && startPhase !== undefined) {
		return { error: '--start-phase applies to a plan folder holding an overview.md — a single plan has one phase' };
	}

	const planName = await planNameFromPath({ cwd, planPath });
	const terms = await readWorkOrderRunTerms({ cwd, name: planName, planPath: 'overviewPath' in target ? target.overviewPath : target.planPath });

	if (terms.refusal !== undefined) {
		return { error: terms.refusal };
	}

	return { planPath, overviewPath, packages, startPhase, planName, shipRequest: terms.shipRequest };
};
