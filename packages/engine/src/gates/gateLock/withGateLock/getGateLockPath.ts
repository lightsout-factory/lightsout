import { join } from 'node:path';
import { resolveSharedStateDir } from '#src/common/workspace/resolveSharedStateDir.ts';

interface Params {
	cwd: string;
}

/**
 * One reservation per repository, in the primary checkout. Resolving it asks
 * git, so callers resolve it once per gate run rather than inside a poll loop.
 */
export const getGateLockPath = async ({ cwd }: Params): Promise<string> => {
	return join(await resolveSharedStateDir({ cwd }), 'gate-lock.json');
};
