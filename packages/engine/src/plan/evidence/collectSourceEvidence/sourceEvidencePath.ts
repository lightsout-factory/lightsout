import { join } from 'node:path';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the folder the plan's own files live in. */
	name: string;
}

/**
 * Deliberately absent from `durablePlanFileNames`: collected evidence is
 * regenerable run state, so it never travels with a published plan.
 */
export const sourceEvidencePath = async ({ cwd, name }: Params): Promise<string> => join(await planWorkspaceDir({ cwd, name }), 'source-evidence.json');
