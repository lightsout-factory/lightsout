import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups.ts';
import type { StandardsRuleListing } from '#src/standardsCheck/common/types/StandardsRuleListing.ts';
import { listStandardsRules } from '#src/standardsCheck/listStandardsRules.ts';

interface Params {
	cwd: string;
}

// A missing config is tolerated: standards are opt-in, so a repo with none lists no rules.
export const readStandardsLedger = async ({ cwd }: Params): Promise<{ config?: LightsoutConfig; rules: StandardsRuleListing[] }> => {
	const config = await readOptionalConfig({ cwd });
	const groups = await resolveStandardsGroups({ cwd, config });

	return { config, rules: listStandardsRules({ groups }) };
};
