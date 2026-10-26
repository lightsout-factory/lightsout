import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/** One rule's setting as packs wrote it: severity and options last-wins, `exclude` unioned across merges. */
export interface PackRuleSetting {
	severity?: StandardsSeverity;
	options: Record<string, number>;
	exclude: string[];
}
