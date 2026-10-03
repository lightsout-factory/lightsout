import type { LoadedStandardsPackFile } from '#src/standardsLibraries/common/types/LoadedStandardsPackFile.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';

export interface LoadedStandardsLibrary {
	name: string;
	formatVersion: number;
	/**
	 * Present and true for a library the bundler produced, which ships without the
	 * fixture pairs and unit tests that prove it; absent for an authored one,
	 * exactly as the root file carries it. Nothing about running a library depends
	 * on this — only `lightsout standards-validate`, which has nothing to run
	 * against a built library and says so rather than blaming its rules.
	 */
	built?: true;
	/** One line a pack page shows under the library's name, from the root file; absent when the library states none. */
	description?: string;
	/** Absolute URL for the library's own page or repository, from the root file. */
	homepage?: string;
	/** Absolute library root. */
	rootPath: string;
	documents: LoadedStandardsTopic[];
	rules: LoadedStandardsRule[];
	/** The library's pack files, sorted by name; empty when it ships no `packs/` folder. */
	packs: LoadedStandardsPackFile[];
}
