import { isAbsolute, join } from 'node:path';
import { pathExists } from '#src/plan/common/paths/pathExists.ts';

interface Params {
	cwd: string;
	/** A citation's path span only: `file.ts:symbol` names the file and never the symbol. */
	token: string;
}

export const citedPathExists = async ({ cwd, token }: Params): Promise<boolean> => pathExists({ path: isAbsolute(token) ? token : join(cwd, token) });
