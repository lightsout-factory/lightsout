import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

export interface ResolvedRuleState {
	/** May be `off` — a rule resolved to `off` is never run, so no finding ever carries it. */
	severity: StandardsSeverity;
	options: Record<string, number>;
	/** True when the repo's standards-rule-settings named this rule — `--list` marks those rows so a reader can tell policy from default. */
	fromConfig: boolean;
	/** True when the rule's prose goes to agents: on in the pack, or turned on by the repo. A repo `off` keeps it true. */
	reachesAgents: boolean;
}
