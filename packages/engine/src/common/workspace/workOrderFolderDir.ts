import { join } from 'node:path';
import { workOrdersDir } from '#src/common/workspace/workOrdersDir.ts';

interface Params {
	/** The directory the command runs in — a primary checkout, a linked worktree, or no repository at all. */
	cwd: string;
	/** The work order's label, which is also the folder its state and plans sit in. */
	name: string;
}

// Takes a `cwd` rather than a resolved state directory, so the folder is always
// under the primary checkout by construction rather than by every caller remembering.
export const workOrderFolderDir = async ({ cwd, name }: Params): Promise<string> => join(await workOrdersDir({ cwd }), name);
