import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { printRefactorResult } from '#src/cli/internal/common/render/printRefactorResult.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import { runBatchedCommand } from '#src/cli/internal/common/utils/runBatchedCommand.ts';
import { runRefactorPipeline } from '#src/refactor/runRefactorPipeline.ts';

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
