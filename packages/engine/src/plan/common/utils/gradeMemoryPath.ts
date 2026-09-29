import { join } from 'node:path';
import { gradeMemoryFileName } from '#src/plan/internal/common/constants/gradeMemoryFileName.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the folder the plan's own files live in. */
	name: string;
}

export const gradeMemoryPath = async ({ cwd, name }: Params): Promise<string> => join(await planWorkspaceDir({ cwd, name }), gradeMemoryFileName);
