import { stat } from 'node:fs/promises';
import { resolveCommandHarness } from '#src/cli/common/resolveCommandHarness.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import { resolveConfigPath } from '#src/common/config/resolveConfigPath.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { getDriver } from '#src/drivers/getDriver/getDriver.ts';

interface Params {
	cwd: string;
	/** Which lightsout command is resolving — selects the config's per-command entry. */
	command: keyof NonNullable<LightsoutConfig['commands']>;
}

/**
 * The returned config is the effective one: its top-level harness, model and
 * effort are overwritten with this command's resolved values, so downstream
 * reads of `config.model` are already per-command.
 */
export const resolveConfigAndDriver = async ({
	cwd,
	command,
}: Params): Promise<{ config: LightsoutConfig | undefined; driver: Driver; configPath: string | undefined }> => {
	const configPath = resolveConfigPath({ cwd });
	const present = await stat(configPath).then(
		() => true,
		() => false,
	);
	// A missing config is fine — plan and improve can run before one exists. A
	// config that is there and does not parse stops the run: continuing would
	// silently discard every setting in it.
	const loaded = present ? await readConfig({ cwd }) : undefined;
	const { driverName, model, effort } = resolveCommandHarness({ config: loaded, command });
	const driver = getDriver({ name: driverName });
	const config = loaded ? { ...loaded, harness: driverName, model, effort } : undefined;

	return { config, driver, configPath: present ? configPath : undefined };
};
