import type { StandardsRuleSettings } from '#src/contracts/StandardsRuleSettings.ts';

/** One parsed pack file. It carries no library: a pack is always reached through the library holding it. */
export interface LoadedStandardsPackFile {
	/** File stem — the part of the address after `<library>/`. */
	name: string;
	/** Library-relative, e.g. 'packs/node.json'; names the file in every problem reported against it. */
	filePath: string;
	description: string;
	/** Every list present, defaulted to empty — readers never branch on a missing list. */
	include: { packs: string[]; topics: string[]; rules: string[] };
	/** The file's `rule-settings`, defaulted to empty. */
	ruleSettings: StandardsRuleSettings;
	/** The file's `applies-when`; undefined on a pack that applies to every package. */
	appliesWhen: { dependencies: string[] } | undefined;
}
