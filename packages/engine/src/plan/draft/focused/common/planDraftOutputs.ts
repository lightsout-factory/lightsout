import { join } from 'node:path';
import { PlanVariant } from '#src/contracts/plan/draft/PlanVariant.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

interface Params {
	cwd: string;
	name: string;
	variant: PlanVariant;
}

/** Only the overview is named for a phased draft: the agent chooses the phase breakdown, so the phase paths come back in its report. */
export const planDraftOutputs = async ({ cwd, name, variant }: Params): Promise<{ path: string; variant: PlanVariant }[]> => {
	const dir = await planWorkspaceDir({ cwd, name });

	return variant === PlanVariant.Single
		? [{ path: join(dir, 'plan.md'), variant: PlanVariant.Single }]
		: [{ path: join(dir, 'overview.md'), variant: PlanVariant.Overview }];
};
