import type { StandardsCheckFunction, StandardsInputKind, StandardsSet } from '@lightsout/standards-contracts';
import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { RuleExample } from '#src/contracts/views/RuleExample.ts';

export interface LoadedStandardsRule {
	/** Folder name minus the numeric prefix — unique inside its library, the address the pack pages and fixture problems use. */
	id: string;
	/** The full name `<library>/<rule-id>` — the key every finding, site key, rule state and listing uses. */
	name: string;
	/** The manifest name of the library the rule belongs to. */
	library: string;
	set: StandardsSet;
	/** Pack-relative document folder path, e.g. 'code/code-style/functions'. */
	documentPath: string;
	/** One line from rule.md front matter — what the rule catches. */
	summary: string;
	/** rule.md body — the rule's full prose argument. */
	prose: string;
	/** True when the rule has a deterministic check — it declares `checks: deterministic` or `checks: both` and ships the check file. */
	deterministic: boolean;
	/** True when the rule has an agent check — it declares `checks: agent`, or `checks: both` because its deterministic check decides only part of what it says. */
	agent: boolean;
	/** `off` marks a rule a repo opts into: it runs, and its prose reaches agents, only once the repo's config names it. */
	defaultSeverity: StandardsSeverity;
	/** The numbers the rule.md header declares under `options`. */
	defaultOptions: Record<string, number>;
	/** Full names of the rules this rule's text depends on — the rule.md `requires` list, resolved when the library is read. */
	requires: string[];
	/** Every input kind the deterministic check declared; present iff deterministic. */
	inputKinds?: StandardsInputKind[];
	/** The validated deterministic check, present iff deterministic. */
	run?: StandardsCheckFunction;
	/** How rule.md says its examples are shaped; absent when it declares none, and a page reads the shape off the files. */
	example?: RuleExample;
	/** Absolute path of the folder holding pass/ and fail/. */
	fixturesPath: string;
}
