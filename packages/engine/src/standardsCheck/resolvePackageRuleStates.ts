import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/internal/common/types/ResolvedRuleState.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { resolveRuleName } from '#src/standardsLibraries/resolveRuleName.ts';

interface Params {
	packs: LoadedStandardsLibrary[];
	config?: LightsoutConfig;
}

/** Every loaded rule at its own defaults, keyed by full name — the map the config then layers over. */
const collectDefaultStates = ({ packs }: { packs: LoadedStandardsLibrary[] }) => {
	const states = new Map<string, ResolvedRuleState>();
	const owners = new Map<string, LoadedStandardsLibrary>();
	const rules: LoadedStandardsRule[] = [];

	for (const pack of packs) {
		for (const rule of pack.rules) {
			const owner = owners.get(rule.name);

			if (owner !== undefined) {
				throw new Error(
					`duplicate rule name "${rule.name}": claimed by standards libraries "${owner.name}" (${owner.rootPath}) and "${pack.name}" (${pack.rootPath})`,
				);
			}

			owners.set(rule.name, pack);
			rules.push(rule);
			states.set(rule.name, { severity: rule.defaultSeverity, options: { ...rule.defaultOptions }, fromConfig: false });
		}
	}

	return { states, rules };
};

/**
 * Every refusal lives here because this is the first moment the valid rule
 * names exist. Two libraries claiming one full name would make config keys and
 * site keys ambiguous; a config key naming no loaded rule, or a short id
 * several libraries share, is a typo that would otherwise disable a policy its
 * author believes is live; and two keys naming one rule leave no answer to
 * which of them wins.
 *
 * @throws {Error} When two libraries claim one full rule name, a `standards-rule-settings` key
 * resolves to no single loaded rule, or two keys resolve to the same rule.
 */
export const resolvePackageRuleStates = ({ packs, config }: Params): Map<string, ResolvedRuleState> => {
	const { states, rules } = collectDefaultStates({ packs });
	const keyFor = new Map<string, string>();

	for (const [key, override] of Object.entries(config?.['standards-rule-settings'] ?? {})) {
		const resolved = resolveRuleName({ name: key, rules });

		if ('problem' in resolved) {
			throw new Error(`standards-rule-settings names "${key}": ${resolved.problem} — valid rule names: ${[...states.keys()].sort().join(', ')}`);
		}

		const { name } = resolved.rule;
		const earlierKey = keyFor.get(name);

		if (earlierKey !== undefined) {
			throw new Error(`standards-rule-settings names the rule "${name}" twice, as "${earlierKey}" and as "${key}" — keep one of them`);
		}

		keyFor.set(name, key);

		// No other key names this rule, so the setting layers over the rule's own defaults.
		const object = typeof override === 'object' ? override : undefined;

		states.set(name, {
			severity: (typeof override === 'string' ? override : object?.severity) ?? resolved.rule.defaultSeverity,
			options: { ...resolved.rule.defaultOptions, ...object?.options },
			fromConfig: true,
		});
	}

	return states;
};
