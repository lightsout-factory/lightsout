import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';

export interface LoadedStandardsLibrary {
	name: string;
	formatVersion: number;
	/**
	 * Present and true for a pack the bundler produced, which ships without the
	 * fixture pairs and unit tests that prove it; absent for an authored one,
	 * exactly as the root file carries it. Nothing about running a pack depends
	 * on this — only `lightsout standards-validate`, which has nothing to run
	 * against a built pack and says so rather than blaming its rules.
	 */
	built?: true;
	/** One line a pack page shows under its name, from the root file; absent when the pack states none. */
	description?: string;
	/** Absolute URL for the pack's own page or repository, from the root file. */
	homepage?: string;
	/** Absolute pack root. */
	rootPath: string;
	/**
	 * Absolute path of `<pack>/fixtures/framework-owned/`, present only when the
	 * pack ships one. Every checked rule is held to silence on each framework's
	 * miniature repo there, so no rule judges code its framework owns.
	 */
	frameworkOwnedFixturesPath?: string;
	documents: LoadedStandardsTopic[];
	rules: LoadedStandardsRule[];
}
