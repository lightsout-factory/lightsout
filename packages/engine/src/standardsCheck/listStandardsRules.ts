import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { StandardsRuleListing } from '#src/standardsCheck/common/types/StandardsRuleListing.ts';
import { resolvePackageRuleStates } from '#src/standardsCheck/resolvePackageRuleStates.ts';
import { resolveStandardsPacks } from '#src/standardsPacks/resolveStandardsPacks.ts';

interface Params {
	cwd: string;
	config?: LightsoutConfig;
}

/**
 * Judgment-only rules are listed beside the machine-checked ones: a rule nobody
 * can find out about is a rule nobody follows.
 *
 * @throws {Error} When a declared standards pack cannot be loaded, or the config names a rule no pack declares.
 */
export const listStandardsRules = async ({ cwd, config }: Params): Promise<StandardsRuleListing[]> => {
	const packs = await resolveStandardsPacks({ cwd, config });
	const states = resolvePackageRuleStates({ packs, config });
	const listings: StandardsRuleListing[] = [];

	for (const pack of packs) {
		for (const rule of pack.rules) {
			const state = states.get(rule.id);

			// Skips nothing in practice; it keeps a rule from ever being listed with
			// a state nobody resolved.
			if (state === undefined) {
				continue;
			}

			listings.push({
				rule: rule.id,
				doc: `${pack.name}: ${rule.documentPath}`,
				summary: rule.summary,
				checked: rule.checked,
				severity: state.severity,
				fromConfig: state.fromConfig,
				settings: state.settings,
			});
		}
	}

	return listings.sort((first, second) => first.rule.localeCompare(second.rule));
};
