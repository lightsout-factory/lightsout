import { parseConfig } from '#src/common/config/parseConfig.ts';
import { readConfigFile } from '#src/common/config/readConfigFile.ts';
import { resolveConfigPath } from '#src/common/config/resolveConfigPath.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';

interface Params {
	cwd: string;
}

export const readConfig = async ({ cwd }: Params): Promise<LightsoutConfig> => {
	const configPath = resolveConfigPath({ cwd });
	const raw = await readConfigFile({ configPath });

	if (raw === undefined) {
		throw new Error(`lightsout.config.json not found at ${configPath}`);
	}

	return parseConfig({ raw, configPath });
};
