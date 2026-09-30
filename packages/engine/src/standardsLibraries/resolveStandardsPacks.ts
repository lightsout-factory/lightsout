import { isAbsolute, resolve } from 'node:path';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { resolveDefaultStandardsLibrary } from '#src/standardsLibraries/resolveDefaultStandardsLibrary.ts';

interface Params {
	cwd: string;
	config?: LightsoutConfig;
}

const resolveRoots = ({ cwd, standardsLibraries }: { cwd: string; standardsLibraries: string[] | false | undefined }) => {
	if (standardsLibraries === false) {
		return [];
	}

	if (standardsLibraries === undefined) {
		return [resolveDefaultStandardsLibrary()];
	}

	return standardsLibraries.map((entry) => (isAbsolute(entry) ? entry : resolve(cwd, entry)));
};

/**
 * A config key or a site key naming a colliding full name would be ambiguous.
 * Full names collide only when two roots carry one manifest name; a short id
 * two differently named libraries share is no clash.
 */
const findCrossPackDuplicates = ({ packs }: { packs: LoadedStandardsLibrary[] }) => {
	const owners = new Map<string, LoadedStandardsLibrary>();
	const duplicates: string[] = [];

	for (const pack of packs) {
		for (const rule of pack.rules) {
			const owner = owners.get(rule.name);

			if (owner === undefined) {
				owners.set(rule.name, pack);
			} else {
				duplicates.push(`duplicate rule name "${rule.name}": claimed by ${owner.rootPath} and ${pack.rootPath}`);
			}
		}
	}

	return duplicates;
};

/**
 * Packs load one at a time, so the first bad root is the one reported. Loading
 * is left to throw — a consumer that declared standards and did not get them
 * must not run.
 *
 * @throws {Error} When a declared pack cannot be loaded, or two loaded packs claim one full rule name.
 */
export const resolveStandardsPacks = async ({ cwd, config }: Params): Promise<LoadedStandardsLibrary[]> => {
	const roots = resolveRoots({ cwd, standardsLibraries: config?.['standards-packs'] });
	const packs: LoadedStandardsLibrary[] = [];

	for (const packPath of roots) {
		packs.push(await readStandardsLibrary({ packPath }));
	}

	const duplicates = findCrossPackDuplicates({ packs });

	if (duplicates.length > 0) {
		throw new Error(`standards packs disagree about rule names:\n${duplicates.map((duplicate) => `- ${duplicate}`).join('\n')}`);
	}

	return packs;
};
