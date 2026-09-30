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

/** A config override or a site key naming a colliding id would be ambiguous. */
const findCrossPackDuplicates = ({ packs }: { packs: LoadedStandardsLibrary[] }) => {
	const owners = new Map<string, LoadedStandardsLibrary>();
	const duplicates: string[] = [];

	for (const pack of packs) {
		for (const rule of pack.rules) {
			const owner = owners.get(rule.id);

			if (owner === undefined) {
				owners.set(rule.id, pack);
			} else {
				duplicates.push(`duplicate rule id "${rule.id}": claimed by ${owner.name} (${owner.rootPath}) and ${pack.name} (${pack.rootPath})`);
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
 * @throws {Error} When a declared pack cannot be loaded, or two loaded packs claim one rule id.
 */
export const resolveStandardsPacks = async ({ cwd, config }: Params): Promise<LoadedStandardsLibrary[]> => {
	const roots = resolveRoots({ cwd, standardsLibraries: config?.['standards-packs'] });
	const packs: LoadedStandardsLibrary[] = [];

	for (const packPath of roots) {
		packs.push(await readStandardsLibrary({ packPath }));
	}

	const duplicates = findCrossPackDuplicates({ packs });

	if (duplicates.length > 0) {
		throw new Error(`standards packs disagree about rule ids:\n${duplicates.map((duplicate) => `- ${duplicate}`).join('\n')}`);
	}

	return packs;
};
