import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import { libraryOfRequirement } from '#src/standardsLibraries/common/utils/libraryOfRequirement.ts';
import { resolveRuleName } from '#src/standardsLibraries/resolveRuleName.ts';

interface Params {
	libraries: LoadedStandardsLibrary[];
}

/**
 * Checks every requires entry the same way, own-library entries included, so
 * no caller has to know which ones loading already resolved.
 *
 * @returns One line per entry whose library is not loaded or whose rule that library does not declare.
 */
export const findUnresolvedRequirements = ({ libraries }: Params): string[] => {
	const lines: string[] = [];

	for (const rule of libraries.flatMap((library) => library.rules)) {
		for (const entry of rule.requires) {
			const libraryName = libraryOfRequirement({ entry, library: rule.library });
			const library = libraries.find((candidate) => candidate.name === libraryName);

			if (library === undefined) {
				lines.push(`${rule.name} requires "${entry}", but the repo does not register the library ${libraryName}`);
			} else {
				const resolved = resolveRuleName({ name: entry, rules: library.rules });

				if ('problem' in resolved) {
					lines.push(`${rule.name} requires "${entry}" — ${resolved.problem}`);
				}
			}
		}
	}

	return lines;
};
