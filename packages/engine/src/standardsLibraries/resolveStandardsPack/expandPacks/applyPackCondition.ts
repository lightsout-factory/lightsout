import type { LoadedStandardsPackFile } from '#src/common/types/LoadedStandardsPackFile.ts';
import type { PackExpansion } from '#src/standardsLibraries/resolveStandardsPack/expandPacks/common/types/PackExpansion.ts';

interface Params {
	/** `<library>/<file-stem>` of the pack the expansion belongs to. */
	address: string;
	packFile: LoadedStandardsPackFile;
	/** Everything the pack brings in, expanded as if it applied. */
	expansion: PackExpansion;
	/** The dependencies the package declares; undefined = every conditional pack applies. */
	dependencies: ReadonlySet<string> | undefined;
}

/**
 * Judged after the pack is expanded, so a pack file that cannot resolve fails
 * the same way for every package, whichever dependencies it declares. A pack
 * that does not apply keeps its rules as inactive ones: a setting that names
 * one is then inert rather than a name that matches nothing.
 */
export const applyPackCondition = ({ address, packFile, expansion, dependencies }: Params): PackExpansion => {
	const { appliesWhen } = packFile;
	let result = expansion;

	if (appliesWhen !== undefined) {
		const applies = dependencies === undefined || appliesWhen.dependencies.some((name) => dependencies.has(name));

		result = applies
			? { ...expansion, conditionalPacks: new Set([...expansion.conditionalPacks, address]) }
			: {
					topics: new Map(),
					rules: new Map(),
					settings: new Map(),
					conditionalPacks: new Set(),
					inactiveRules: new Map([...expansion.inactiveRules, ...expansion.rules]),
				};
	}

	return result;
};
