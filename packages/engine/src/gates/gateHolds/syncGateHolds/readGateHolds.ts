import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GateHolds } from '#src/common/types/GateHolds.ts';
import { GateHold } from '#src/contracts/gates/GateHold.ts';
import { getGateHoldPaths } from '#src/gates/gateHolds/common/getGateHoldPaths.ts';

interface Params {
	cwd: string;
}

const readOneHold = async ({ path }: { path: string }) => {
	const raw = await readFile(path, 'utf8').catch(() => undefined);

	if (raw === undefined) {
		return undefined;
	}

	try {
		return GateHold.parse(JSON.parse(raw));
	} catch {
		return undefined;
	}
};

/**
 * An absent directory answers an empty map rather than undefined, so every
 * caller has one shape. A file that will not parse is skipped rather than
 * failing the read, because one interrupted write must not hide every other hold.
 */
export const readGateHolds = async ({ cwd }: Params): Promise<GateHolds> => {
	const { dir } = await getGateHoldPaths({ cwd });
	const names = await readdir(dir).catch((): string[] => []);
	const holds: GateHolds = {};

	for (const name of names.filter((entry) => entry.endsWith('.json'))) {
		const hold = await readOneHold({ path: join(dir, name) });

		if (hold !== undefined) {
			holds[name.slice(0, -'.json'.length).toLowerCase()] = hold;
		}
	}

	return holds;
};
