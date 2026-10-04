import type { StandardsRuleSettings } from '#src/contracts/StandardsRuleSettings.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import type { ResolvedPackRule } from '#src/standardsLibraries/common/types/ResolvedPackRule.ts';
import type { ResolvedStandardsPack } from '#src/standardsLibraries/common/types/ResolvedStandardsPack.ts';
import { mapPackRules } from '#src/standardsLibraries/mapPackRules.ts';
import { resolveRuleName } from '#src/standardsLibraries/resolveRuleName.ts';

interface RuleSetting {
	severity?: StandardsSeverity;
	options?: Record<string, number>;
}

/** Each entry keyed by the full name it resolves to, so a short name and a full name reach one rule alike. */
const resolveEntries = ({ packs, ruleSettings }: { packs: ResolvedStandardsPack[]; ruleSettings: StandardsRuleSettings }) => {
	// An inactive rule resolves too, so a setting for a framework a repo does not use yet is inert, not an error.
	const rules = [...new Map([...packs.flatMap((pack) => pack.inactiveRules), ...mapPackRules({ packs }).values()].map((rule) => [rule.name, rule])).values()];
	const settings = new Map<string, RuleSetting>();
	const keyFor = new Map<string, string>();

	for (const [key, entry] of Object.entries(ruleSettings)) {
		const resolved = resolveRuleName({ name: key, rules });

		if ('problem' in resolved) {
			throw new Error(`standards-rule-settings names "${key}": ${resolved.problem} in the selected standards pack`);
		}

		const { name } = resolved.rule;
		const earlierKey = keyFor.get(name);

		if (earlierKey !== undefined) {
			throw new Error(`standards-rule-settings names the rule "${name}" twice, as "${earlierKey}" and as "${key}" — keep one of them`);
		}

		keyFor.set(name, key);
		settings.set(name, typeof entry === 'string' ? { severity: entry } : entry);
	}

	return settings;
};

/** A repo `off` stops the rule running but keeps its prose; only `blocking` or `advisory` brings in a rule the pack ships off. */
const stateOf = ({ packRule, setting }: { packRule: ResolvedPackRule; setting: RuleSetting | undefined }) => ({
	severity: setting?.severity ?? packRule.severity,
	options: { ...packRule.options, ...setting?.options },
	fromConfig: setting !== undefined,
	reachesAgents: packRule.severity !== StandardsSeverity.Off || (setting?.severity !== undefined && setting.severity !== StandardsSeverity.Off),
});

interface Params {
	packs: ResolvedStandardsPack[];
	/** The repo's `standards-rule-settings`, or undefined when unset. */
	ruleSettings: StandardsRuleSettings | undefined;
}

/**
 * The repo's layer over packs that already applied every rule.md default and
 * every pack setting, so a state starts from the pack's grade. Severity
 * replaces; options merge key by key. An entry applies to every pack holding
 * its rule and leaves the others alone, and does nothing when only a
 * conditional pack that did not apply holds it.
 *
 * @returns One map per pack, in `packs` order, keyed by full rule name.
 * @throws {Error} When an entry names no rule in any of the packs, a short name is ambiguous, or two entries name one rule.
 */
export const resolveRuleStates = ({ packs, ruleSettings }: Params): Map<string, ResolvedRuleState>[] => {
	const settings = resolveEntries({ packs, ruleSettings: ruleSettings ?? {} });

	return packs.map((pack) => {
		const states = new Map<string, ResolvedRuleState>();

		for (const packRule of pack.rules) {
			states.set(packRule.rule.name, stateOf({ packRule, setting: settings.get(packRule.rule.name) }));
		}

		return states;
	});
};
