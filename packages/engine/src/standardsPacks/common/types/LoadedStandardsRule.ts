import type { StandardsCheckFunction, StandardsInputKind, StandardsSet } from '@lightsout/standards-contracts';
import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { RuleExample } from '#src/contracts/views/RuleExample.ts';

/** One rule folder, read: its prose, its declaration, and its check when it ships one. */
export interface LoadedStandardsRule {
	/** Folder name minus the numeric prefix — unique pack-wide. */
	id: string;
	set: StandardsSet;
	/** Pack-relative document folder path, e.g. 'code/style-guide/patterns/functions'. */
	documentPath: string;
	/** One line from rule.md front matter — what the rule catches. */
	summary: string;
	/** rule.md body — the rule's full prose argument. */
	prose: string;
	/** Inherited from the owning document's front matter — 'base' when it declares none. */
	channel: string;
	/** True when the folder declares (and ships) a machine check. */
	checked: boolean;
	/** `off` marks a rule a repo opts into: it runs, and its prose reaches agents, only once the repo's config names it. */
	defaultSeverity: StandardsSeverity;
	defaultSettings: Record<string, number>;
	/** Present iff checked. */
	inputKind?: StandardsInputKind;
	/** The validated check, present iff checked. */
	run?: StandardsCheckFunction;
	/** How rule.md says its examples are shaped; absent when it declares none, and a page reads the shape off the files. */
	example?: RuleExample;
	/** Absolute path of the folder holding pass/ and fail/. */
	fixturesPath: string;
}
