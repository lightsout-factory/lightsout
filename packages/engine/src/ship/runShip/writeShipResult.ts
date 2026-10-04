import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ShipResult } from '#src/contracts/ship/ShipResult.ts';
import { getShipResultPath } from '#src/ship/common/getShipResultPath.ts';

interface Params {
	cwd: string;
	result: ShipResult;
}

/**
 * Written through a tmp file and a rename because another tool reads it, and a crash mid-write
 * must not leave half a JSON document. A branch no work order claims is filed nowhere; the forge
 * stays ship's durable record.
 */
export const writeShipResult = async ({ cwd, result }: Params): Promise<string | undefined> => {
	const resultPath = result.branch === undefined ? undefined : await getShipResultPath({ cwd, branch: result.branch });

	if (resultPath === undefined) {
		return undefined;
	}

	const tmpPath = `${resultPath}.tmp`;

	await mkdir(dirname(resultPath), { recursive: true });
	await writeFile(tmpPath, `${JSON.stringify(result, null, '\t')}\n`, 'utf8');
	await rename(tmpPath, resultPath);

	return resultPath;
};
