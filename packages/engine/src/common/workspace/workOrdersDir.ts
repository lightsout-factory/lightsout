import { join } from 'node:path';
import { resolveSharedStateDir } from '#src/common/workspace/resolveSharedStateDir.ts';

interface Params {
	/** The directory the command runs in — a primary checkout, a linked worktree, or no repository at all. */
	cwd: string;
}

/**
 * The primary checkout is resolved here rather than passed in, so no caller can
 * pass the wrong one: every checkout must see one set of tickets, and a removed
 * worktree must take none with it.
 */
export const workOrdersDir = async ({ cwd }: Params): Promise<string> => join(await resolveSharedStateDir({ cwd }), 'work-orders');
