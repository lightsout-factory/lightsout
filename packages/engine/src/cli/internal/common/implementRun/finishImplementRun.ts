import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { printResult } from '#src/cli/internal/common/render/printResult.ts';
import { exitAfterImplement } from '#src/cli/internal/common/utils/exitAfterImplement.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';

interface Params {
	/** The config as it was read from disk, before the command stamped its harness on it. */
	config: LightsoutConfig;
	/** The workspace the run built in — the tree the result describes and the branch ship would push. */
	cwd: string;
	result: PipelineResult;
	flags: CommandContext['flags'];
}

export const finishImplementRun = async ({ config, cwd, result, flags }: Params): Promise<never> => {
	await printResult({ result, cwd });

	return exitAfterImplement({
		config,
		cwd,
		result,
		shipFlag: flags.get('ship') === true,
		noShipFlag: flags.get('no-ship') === true,
		env: process.env,
	});
};
