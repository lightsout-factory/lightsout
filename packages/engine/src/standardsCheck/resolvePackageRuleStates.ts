import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/internal/common/types/ResolvedRuleState.ts';
import type { LoadedStandardsPack } from '#src/standardsPacks/common/types/LoadedStandardsPack.ts';

interface Params {
	packs: LoadedStandardsPack[];
	config?: LightsoutConfig;
}

/**
 * Both refusals live here because this is the first moment the valid rule ids
 * exist. Two packs claiming one id would make config overrides and site keys
 * ambiguous, and a config key naming no loaded rule is a typo that would
 * otherwise disable a policy its author believes is live.
 *
 * @throws {Error} When two packs claim one rule id, or a config entry names no loaded rule.
 */
export const resolvePackageRuleStates = ({ packs, config }: Params): Map<string, ResolvedRuleState> => {
	const states = new Map<string, ResolvedRuleState>();
	const owners = new Map<string, string>();

	for (const pack of packs) {
		for (const rule of pack.rules) {
			const owner = owners.get(rule.id);

			if (owner !== undefined) {
				throw new Error(`duplicate rule id "${rule.id}": claimed by standards packs "${owner}" and "${pack.name}"`);
			}

			owners.set(rule.id, pack.name);
			states.set(rule.id, { severity: rule.defaultSeverity, options: { ...rule.defaultOptions }, fromConfig: false });
		}
	}

	for (const [id, override] of Object.entries(config?.['standards-checks'] ?? {})) {
		const state = states.get(id);

		if (state === undefined) {
			throw new Error(`standards-checks names "${id}", which no loaded standards pack declares — valid rule ids: ${[...states.keys()].sort().join(', ')}`);
		}

		const object = typeof override === 'object' ? override : undefined;

		states.set(id, {
			severity: (typeof override === 'string' ? override : object?.severity) ?? state.severity,
			options: { ...state.options, ...object?.options },
			fromConfig: true,
		});
	}

	return states;
};
