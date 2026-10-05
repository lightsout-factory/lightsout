import { parseConfig } from '#src/common/config/parseConfig.ts';
import { readConfigFile } from '#src/common/config/readConfigFile.ts';
import { resolveConfigPath } from '#src/common/config/resolveConfigPath.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

interface Params {
	cwd: string;
}

/**
 * Throws on a config that does not parse: silently falling back to defaults
 * for a broken config changes what a command does with nothing saying why.
 */
export const readOptionalConfig = async ({ cwd }: Params): Promise<LightsoutConfig | undefined> => {
	const configPath = resolveConfigPath({ cwd });
	const raw = await readConfigFile({ configPath });

	return raw === undefined ? undefined : parseConfig({ raw, configPath });
};
