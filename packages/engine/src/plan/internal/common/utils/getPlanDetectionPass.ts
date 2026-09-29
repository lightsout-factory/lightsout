import { mkdir } from 'node:fs/promises';
import { getPlanDetectionInputs } from '#src/plan/internal/common/utils/getPlanDetectionInputs.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

interface Params {
	cwd: string;
	name: string;
}

type PlanDetectionPass = Awaited<ReturnType<typeof getPlanDetectionInputs>> & {
	/** Created before the inputs are resolved, so a failed resolve still has somewhere to report from. */
	workspaceDir: string;
};

export const getPlanDetectionPass = async ({ cwd, name }: Params): Promise<PlanDetectionPass> => {
	const workspaceDir = await planWorkspaceDir({ cwd, name });

	await mkdir(workspaceDir, { recursive: true });

	const inputs = await getPlanDetectionInputs({ cwd, name });

	return { ...inputs, workspaceDir };
};
