import type { ResolvedPackRule } from '#src/common/types/ResolvedPackRule.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';

interface Params {
	/** The rules a resolved pack holds, each at the severity the pack gives it. */
	rules: ResolvedPackRule[];
	/** The repo's final rule states, keyed by full rule name. Absent when a pack is judged on its own. */
	states?: Map<string, ResolvedRuleState>;
}

/**
 * A required rule is missing when it will not reach agents, so an agent would
 * read an instruction that points at nothing. With states, reach is read from
 * them and never recomputed: rule-state resolution is the one place that
 * decides it, so this judges reach exactly as the run's prose does.
 *
 * @returns Each missing requirement as full rule names, sorted by rule then required rule.
 */
export const findMissingRequirements = ({ rules, states }: Params): Array<{ rule: string; required: string }> => {
	const reachesAgents = ({ packRule }: { packRule: ResolvedPackRule }) =>
		states === undefined ? packRule.severity !== StandardsSeverity.Off : states.get(packRule.rule.name)?.reachesAgents === true;
	const reaching = rules.filter((packRule) => reachesAgents({ packRule }));
	const reachingNames = new Set(reaching.map((packRule) => packRule.rule.name));
	const missing = reaching.flatMap((packRule) =>
		packRule.rule.requires.filter((required) => !reachingNames.has(required)).map((required) => ({ rule: packRule.rule.name, required })),
	);

	return missing.sort((first, second) => first.rule.localeCompare(second.rule) || first.required.localeCompare(second.required));
};
