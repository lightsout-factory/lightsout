import { z } from 'zod';
import { parseConfig } from '#src/common/config/parseConfig.ts';
import { readConfigFile } from '#src/common/config/readConfigFile.ts';
import { resolveConfigPath } from '#src/common/config/resolveConfigPath.ts';
import { describePackageSet } from '#src/common/workspace/describePackageSet.ts';
import type { ConfigView } from '#src/contracts/views/config/ConfigView.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts';
import { listStandardsRules } from '#src/standardsCheck/listStandardsRules.ts';
import { mapPackRules } from '#src/standardsLibraries/mapPackRules.ts';
import { ConfigNotFoundError } from '#src/views/ConfigNotFoundError.ts';
import { buildConfigSections } from '#src/views/internal/common/utils/buildConfigSections.ts';

/**
 * Deliberately lenient: `parseConfig` has already accepted this text, and here
 * only which keys were typed matters.
 */
const DeclaredConfig = z.object({ timeouts: z.record(z.string(), z.unknown()).optional() }).catchall(z.unknown());

const listDeclaredKeys = ({ raw }: { raw: string }) => {
	const declared = DeclaredConfig.parse(JSON.parse(raw));

	return [...Object.keys(declared), ...Object.keys(declared.timeouts ?? {}).map((leaf) => `timeouts.${leaf}`)];
};

interface Params {
	cwd: string;
}

/**
 * Every default comes from the engine's own named constants rather than a second
 * table that could disagree with them.
 *
 * @throws {ConfigNotFoundError} When no `lightsout.config.json` exists; the page 404s.
 * @throws {Error} When the file fails to parse; the route's error boundary shows the zod message.
 */
export const getConfigView = async ({ cwd }: Params): Promise<ConfigView> => {
	const configPath = resolveConfigPath({ cwd });
	const raw = await readConfigFile({ configPath });

	if (raw === undefined) {
		throw new ConfigNotFoundError({ configPath });
	}

	const config = parseConfig({ raw, configPath });
	const groups = await resolveStandardsGroups({ cwd, config });
	const listings = listStandardsRules({ groups });
	// `StandardsRuleListing` carries no library field, and re-parsing its `doc`
	// display string would be a second format to keep true, so the pack rules answer.
	const packRules = mapPackRules({ packs: groups.map((group) => group.pack) });

	return {
		path: configPath,
		harness: config.harness ?? null,
		model: config.model ?? null,
		sections: buildConfigSections({ config, declaredKeys: listDeclaredKeys({ raw }) }),
		standardsGroups: groups.map((group) => ({
			packages: group.packages,
			appliesTo: describePackageSet({ packages: group.packages }),
			pack: group.pack.name,
			conditionalPacks: group.pack.conditionalPacks,
		})),
		ruleStates: listings.flatMap((listing) => {
			const rule = packRules.get(listing.rule);

			return rule === undefined
				? []
				: [
						{
							rule: listing.rule,
							id: rule.id,
							library: rule.library,
							severity: listing.severity,
							fromConfig: listing.fromConfig,
							options: listing.options,
							packages: listing.packages,
							appliesTo: describePackageSet({ packages: listing.packages }),
						},
					];
		}),
	};
};
