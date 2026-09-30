import type { StandardsSet } from '@lightsout/standards-contracts';

export interface LoadedStandardsTopic {
	set: StandardsSet;
	/** Pack-relative folder path — the assembly header names it. */
	path: string;
	/** 'base' when topic.md front matter declares no channel. */
	channel: string;
	/** topic.md body — title and intro prose. */
	intro: string;
	/** Rule ids in assembly (folder) order. */
	ruleIds: string[];
}
