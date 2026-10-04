import { formatShortRunId } from '@lightsout/shared';
import { exitCli } from '#src/common/exitCli.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { readFriction } from '#src/runState/friction/readFriction.ts';

export const frictionCommand = async ({ cwd }: CommandContext): Promise<void> => {
	const entries = await readFriction({ cwd });

	if (entries.length === 0) {
		console.log('no friction recorded');
		return exitCli({ code: 0 });
	}

	for (const entry of entries) {
		console.log(`[${entry.area}] (run ${formatShortRunId({ runId: entry.runId })}, ${entry.step}, ${entry.at}) ${entry.detail}`);
	}

	return exitCli({ code: 0 });
};
