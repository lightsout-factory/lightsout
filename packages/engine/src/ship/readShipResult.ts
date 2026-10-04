import { readJsonFile } from '#src/common/readJsonFile.ts';
import { ShipResult } from '#src/contracts/ship/ShipResult.ts';
import { getShipResultPath } from '#src/ship/common/getShipResultPath.ts';

interface Params {
	cwd: string;
	branch: string;
}

/**
 * Results are filed per branch, not per run, so this answers what happened the
 * last time this branch was shipped.
 */
export const readShipResult = async ({ cwd, branch }: Params): Promise<ShipResult | undefined> => {
	const path = await getShipResultPath({ cwd, branch });

	return path === undefined ? undefined : readJsonFile({ path, schema: ShipResult });
};
