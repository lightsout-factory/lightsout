import { messageOf } from '#src/common/utils/messageOf.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { builtInStandardsLibraryName } from '#src/contracts/standards/builtInStandardsLibraryName.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import { findUnresolvedRequirements } from '#src/standardsLibraries/findUnresolvedRequirements.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { resolveDefaultStandardsLibrary } from '#src/standardsLibraries/resolveDefaultStandardsLibrary.ts';
import { resolveStandardsLibraryPath } from '#src/standardsLibraries/resolveStandardsLibraryPath.ts';

interface Params {
	cwd: string;
	config?: LightsoutConfig;
	/** An already-loaded library standing in for the built-in one, which is then never read from disk. Must still be named lightsout. */
	builtIn?: LoadedStandardsLibrary;
}

const readRegisteredLibrary = async ({ cwd, name, value }: { cwd: string; name: string; value: string }) => {
	let library: LoadedStandardsLibrary;

	try {
		library = await readStandardsLibrary({ packPath: resolveStandardsLibraryPath({ cwd, name, value }) });
	} catch (error) {
		throw new Error(`standards library ${name} (${value}) will not load: ${messageOf({ error })}`);
	}

	if (library.name !== name) {
		throw new Error(`standards library ${name} (${value}) at ${library.rootPath} is named "${library.name}" in its manifest — the name must equal its key`);
	}

	return library;
};

/**
 * Libraries load one at a time, built-in first and then in config key order,
 * so the first bad entry is the one reported. Loading is left to throw — a
 * repo that registered a library and did not get it must not run.
 *
 * @throws {Error} When an entry resolves to no library, a library will not load, a rule requires a rule no loaded library declares, a manifest name differs from its key, a key is reserved or not one path segment, or the built-in library is not named lightsout.
 */
export const resolveStandardsLibraries = async ({ cwd, config, builtIn }: Params): Promise<LoadedStandardsLibrary[]> => {
	const builtInLibrary = builtIn ?? (await readStandardsLibrary({ packPath: resolveDefaultStandardsLibrary() }));

	if (builtInLibrary.name !== builtInStandardsLibraryName) {
		throw new Error(
			`the built-in standards library at ${builtInLibrary.rootPath} is named "${builtInLibrary.name}" — it must be named ${builtInStandardsLibraryName}`,
		);
	}

	const libraries = [builtInLibrary];

	for (const [name, value] of Object.entries(config?.['standards-libraries'] ?? {})) {
		libraries.push(await readRegisteredLibrary({ cwd, name, value }));
	}

	// Only now can an entry naming another library be checked: that library may load after the one requiring it.
	const unresolved = findUnresolvedRequirements({ libraries });

	if (unresolved.length > 0) {
		throw new Error(`standards libraries require rules that no loaded library declares:\n${unresolved.map((line) => `- ${line}`).join('\n')}`);
	}

	return libraries;
};
