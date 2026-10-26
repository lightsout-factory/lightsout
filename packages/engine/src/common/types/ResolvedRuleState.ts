import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

export interface ResolvedRuleState {
	/** May be `off` — a rule resolved to `off` is never run, so no finding ever carries it. */
	severity: StandardsSeverity;
	options: Record<string, number>;
	/** True when the repo's standards-rule-settings set this rule's severity or options — `--list` marks those rows so a reader can tell policy from default. An exclude-only entry does not count: it changes no grade. */
	fromConfig: boolean;
	/** True when the rule's prose goes to agents: on in the pack, or turned on by the repo. A repo `off` keeps it true. */
	reachesAgents: boolean;
	/** The pack rule's `exclude`: matched against each file's path relative to its own workspace package root (the repo root outside packages). */
	packExclude: string[];
	/** The repo's `standards-rule-settings` `exclude` for the rule, matched against the repo-relative path; empty when the repo sets none. */
	repoExclude: string[];
}
