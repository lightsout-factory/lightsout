import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { runBatchedCommand } from '#src/cli/common/runBatchedCommand/runBatchedCommand.ts';
import { printCoverageResult } from '#src/cli/testCoverageToThresholdCommand/printCoverageResult.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { runCoveragePipeline } from '#src/coverage/runCoveragePipeline/runCoveragePipeline.ts';

export const testCoverageToThresholdCommand = ({ flags, cwd }: CommandContext): Promise<void> =>
	runBatchedCommand({
		flags,
		cwd,
		command: 'test-coverage-to-threshold',
		print: printCoverageResult,
		run: ({ config, loadedConfig, driver, maxBatches, existing }) =>
			runCoveragePipeline({
				cwd,
				driver,
				config,
				loadedConfig,
				maxBatches,
				allowDirty: flags.get('allow-dirty') === true,
				existing,
				onProgress: createProgressPrinter(),
			}),
	});
