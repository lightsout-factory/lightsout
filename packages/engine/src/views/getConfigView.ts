import { z } from 'zod';
import { parseConfig } from '#src/common/config/parseConfig.ts';
import { readConfigFile } from '#src/common/config/readConfigFile.ts';
import { resolveConfigPath } from '#src/common/config/resolveConfigPath.ts';
import type { ConfigView } from '#src/contracts/views/config/ConfigView.ts';
import { listStandardsRules } from '#src/standardsCheck/listStandardsRules.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import { resolveStandardsPacks } from '#src/standardsLibraries/resolveStandardsPacks.ts';
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

const getPackChannels = ({ pack }: { pack: LoadedStandardsLibrary }) => [...new Set(pack.documents.map((document) => document.channel))].sort();

/**
 * `StandardsRuleListing` carries no pack field, and re-parsing its `doc` display
 * string would be a second format to keep true, so the loaded packs answer.
 */
const mapRuleOwners = ({ packs }: { packs: LoadedStandardsLibrary[] }) => {
	const owners = new Map<string, { pack: string; channel: string }>();

	for (const pack of packs) {
		for (const rule of pack.rules) {
			owners.set(rule.id, { pack: pack.name, channel: rule.channel });
		}
	}

	return owners;
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
	const packs = await resolveStandardsPacks({ cwd, config });
	const listings = await listStandardsRules({ cwd, config });
	const owners = mapRuleOwners({ packs });

	return {
		path: configPath,
		harness: config.harness ?? null,
		model: config.model ?? null,
		sections: buildConfigSections({ config, declaredKeys: listDeclaredKeys({ raw }) }),
		// A config naming no pack loads exactly the default one, as
		// `resolveStandardsPacks` encodes.
		packs: packs.map((pack) => ({
			name: pack.name,
			rootPath: pack.rootPath,
			isDefault: config['standards-packs'] === undefined,
			channels: getPackChannels({ pack }),
		})),
		channels: config['standards-channels'] ?? [],
		ruleStates: listings.flatMap((listing) => {
			const owner = owners.get(listing.rule);

			return owner === undefined
				? []
				: [
						{
							rule: listing.rule,
							pack: owner.pack,
							channel: owner.channel,
							severity: listing.severity,
							fromConfig: listing.fromConfig,
							options: listing.options,
						},
					];
		}),
	};
};
