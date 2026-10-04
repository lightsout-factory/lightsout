import { resolveCommandHarness } from '#src/cli/internal/common/utils/resolveCommandHarness.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { getDriver } from '#src/drivers/getDriver/getDriver.ts';

interface Params {
	/** The config as it was read from disk, before this command's harness entry is applied. */
	config: LightsoutConfig;
	/** Which lightsout command is resolving — selects the config's per-command entry. */
	command: keyof NonNullable<LightsoutConfig['commands']>;
}

/**
 * The returned config is the effective one: its top-level harness, model and
 * effort are overwritten with this command's resolved values, so every
 * downstream read of `config.model` is already per-command.
 */
export const resolveEffectiveConfigAndDriver = ({ config, command }: Params): { config: LightsoutConfig; driver: Driver; driverName: string } => {
	const { driverName, model, effort } = resolveCommandHarness({ config, command });

	return { config: { ...config, harness: driverName, model, effort }, driver: getDriver({ name: driverName }), driverName };
};
