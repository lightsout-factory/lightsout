import { join, resolve } from 'node:path';
import { workOrdersDir } from '#src/common/workspace/workOrdersDir.ts';

interface Params {
	/** The checkout the reader is working in — a primary checkout, a linked worktree, or no repository. */
	cwd: string;
	/** A plan path as run state recorded it — repo-relative with forward slashes — or as a `--plan` value gave it. */
	path: string;
}

/**
 * A plan folder lives in the primary checkout whichever checkout is working, so
 * a recorded work-orders path read against a worktree would silently name a
 * file that is not there. Any other path is read against the given checkout.
 */
export const resolveRecordedPlanPath = async ({ cwd, path }: Params): Promise<string> => {
	// Both separators, because the contract spells a recorded path with forward
	// slashes while a `--plan` value carries whatever the user's shell gave it.
	const [stateDir, workOrdersFolder, ...tail] = path.split(/[/\\]/);

	if (stateDir !== '.lightsout' || workOrdersFolder !== 'work-orders' || tail.length === 0) {
		return resolve(cwd, path);
	}

	return join(await workOrdersDir({ cwd }), ...tail);
};
