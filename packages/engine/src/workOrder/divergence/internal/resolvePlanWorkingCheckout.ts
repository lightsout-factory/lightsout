import { dirname } from 'node:path';
import { resolveSharedStateDir } from '#src/common/workspace/resolveSharedStateDir.ts';

interface Params {
	/** Any checkout of the repository the command was launched from. */
	cwd: string;
	name: string;
	planId: string;
}

/**
 * The sync sidecar is one per machine, so `--keep` acts on the copy this machine
 * would publish from, not on whichever checkout the command started in. Plan
 * folders always live in the primary checkout, so `otherCopies` is empty.
 */
export const resolvePlanWorkingCheckout = async ({ cwd }: Params): Promise<{ checkout: string; otherCopies: string[] }> => {
	return { checkout: dirname(await resolveSharedStateDir({ cwd })), otherCopies: [] };
};
