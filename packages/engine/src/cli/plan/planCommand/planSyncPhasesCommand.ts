import { basename } from 'node:path';
import { getRequiredFlag } from '#src/cli/common/args/getRequiredFlag.ts';
import { bold } from '#src/cli/common/terminal/bold.ts';
import { exitCli } from '#src/common/exitCli.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { PlanRunStatus } from '#src/plan/common/constants/PlanRunStatus.ts';
import { syncPlanPhases } from '#src/plan/sections/syncPlanPhases.ts';

export const planSyncPhasesCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const name = await getRequiredFlag({ flags, name: 'name' });
	const result = await syncPlanPhases({ cwd, name });

	if (result.status === PlanRunStatus.Failed) {
		console.error(`\n${result.error}`);
		return exitCli({ code: 1 });
	}

	console.log(`\n${bold(`plan sync-phases ${name}`)}`);

	// Updated or not: a repeated run that moved nothing has to say so.
	console.log(`  ${basename(result.file.path)} — ${result.file.updated ? 'updated' : 'unchanged'}`);

	return exitCli({ code: 0 });
};
