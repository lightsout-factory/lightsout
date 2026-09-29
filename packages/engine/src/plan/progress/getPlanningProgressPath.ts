import { join } from 'node:path';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the plan folder the record lives in. */
	name: string;
}

export const getPlanningProgressPath = async ({ cwd, name }: Params): Promise<string> => join(await planWorkspaceDir({ cwd, name }), 'planning-progress.json');
