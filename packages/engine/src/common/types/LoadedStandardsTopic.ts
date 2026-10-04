import type { StandardsSet } from '@lightsout/standards-contracts';

export interface LoadedStandardsTopic {
	set: StandardsSet;
	/** The manifest name of the library the topic belongs to. */
	library: string;
	/** Pack-relative folder path — the assembly header names it. */
	path: string;
	/** topic.md body — title and intro prose. */
	intro: string;
	/** Rule ids in assembly (folder) order. */
	ruleIds: string[];
}
