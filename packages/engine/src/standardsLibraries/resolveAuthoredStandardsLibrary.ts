import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { standardsLibraryRootFile } from '#src/common/constants/standardsLibraryRootFile.ts';

interface Params {
	cwd: string;
}

/**
 * `resolveDefaultStandardsLibrary` deliberately finds the shipped copy, which
 * carries no fixture pairs; a pack page has to show the examples a rule argues
 * from, so it looks for the authored folder, which still has its fixtures.
 *
 * @returns the absolute folder, or `undefined` when the caller should fall back to the shipped copy
 */
export const resolveAuthoredStandardsLibrary = ({ cwd }: Params): string | undefined => {
	// The same override `resolveDefaultStandardsLibrary` honours, so this repo's own
	// suites and dev server agree with the engine about which pack is the default.
	const override = process.env.LIGHTSOUT_DEFAULT_STANDARDS;
	const candidates = [
		...(override === undefined ? [] : [resolve(override)]),
		// This monorepo's authored pack, then a repo that IS a pack.
		join(cwd, 'packages', 'standards-typescript'),
		resolve(cwd),
	];

	return candidates.find((candidate) => existsSync(join(candidate, standardsLibraryRootFile)));
};
