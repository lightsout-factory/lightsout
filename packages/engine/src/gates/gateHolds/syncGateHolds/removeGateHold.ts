import { unlink } from 'node:fs/promises';
import { getGateHoldPaths } from '#src/gates/gateHolds/common/getGateHoldPaths.ts';

interface Params {
	cwd: string;
	identifier: string;
}

/**
 * An absent hold is swallowed: two drains can reconcile the same released hold
 * at the same moment, and the second removal is not a failure.
 */
export const removeGateHold = async ({ cwd, identifier }: Params): Promise<void> => {
	const { pathFor } = await getGateHoldPaths({ cwd });

	await unlink(pathFor({ identifier })).catch(() => undefined);
};
