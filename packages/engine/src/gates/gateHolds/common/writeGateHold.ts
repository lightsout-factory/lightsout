import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { GateHold } from '#src/contracts/gates/GateHold.ts';
import { getGateHoldPaths } from '#src/gates/gateHolds/common/getGateHoldPaths.ts';

interface Params {
	cwd: string;
	identifier: string;
	hold: GateHold;
}

/**
 * The directory is created first, because a repository that has never timed out
 * does not have one.
 *
 * It never touches any other ticket's file: a writer that rewrote the folder as
 * one document would drop a hold a second worker recorded a moment earlier.
 */
export const writeGateHold = async ({ cwd, identifier, hold }: Params): Promise<void> => {
	const { pathFor } = await getGateHoldPaths({ cwd });
	const path = pathFor({ identifier });

	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, JSON.stringify(hold), 'utf8');
};
