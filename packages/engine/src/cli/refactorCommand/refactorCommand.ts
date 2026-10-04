import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { runBatchedCommand } from '#src/cli/common/runBatchedCommand/runBatchedCommand.ts';
import { printRefactorResult } from '#src/cli/refactorCommand/printRefactorResult.ts';
import { getStringFlag } from '#src/common/getStringFlag.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { runRefactorPipeline } from '#src/refactor/runRefactorPipeline/runRefactorPipeline.ts';

export const refactorCommand = ({ flags, cwd }: CommandContext): Promise<void> =>
	runBatchedCommand({
		flags,
		cwd,
		command: 'refactor',
		print: printRefactorResult,
		run: ({ config, loadedConfig, driver, maxBatches, existing }) =>
			runRefactorPipeline({
				cwd,
				driver,
				config,
				loadedConfig,
				path: getStringFlag({ flags, name: 'path' }),
				all: flags.get('all') === true,
				maxBatches,
				// The same flag the standards check takes: run against the deterministic
				// checks alone, skipping each batch's agent review.
				agentReview: flags.get('deterministic-checks') !== true,
				allowDirty: flags.get('allow-dirty') === true,
				existing,
				onProgress: createProgressPrinter(),
			}),
	});
