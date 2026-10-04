import { readConfig } from '#src/common/config/readConfig.ts';
import { resolveConfigPath } from '#src/common/config/resolveConfigPath.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';

interface Params {
	cwd: string;
}

/**
 * The config a fresh run starts with, read with the strict parser, paired with
 * the file it came from. Both come from the one checkout, so the recorded path
 * always names the file the recorded config was read from.
 */
export const readLoadedConfig = async ({ cwd }: Params): Promise<Required<LoadedConfig>> => ({
	config: await readConfig({ cwd }),
	path: resolveConfigPath({ cwd }),
});
