import { getRequiredFlag } from '#src/cli/common/args/getRequiredFlag.ts';
import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { finishWorkOrderChange } from '#src/cli/workOrder/workOrderCommand/common/finishWorkOrderChange.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { retitleWorkOrderPlan } from '#src/workOrder/retitleWorkOrderPlan.ts';

/**
 * A title is not identity: the plan's id, folder and pending ship request are
 * untouched, so a rename is the one change that never costs a ticket its approval.
 */
export const workOrderRetitlePlanCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const name = await getRequiredFlag({ flags, name: 'name' });
	const plan = await getRequiredFlag({ flags, name: 'plan' });
	const title = await getRequiredFlag({ flags, name: 'title' });
	const config = await readConfig({ cwd });
	const outcome = await retitleWorkOrderPlan({ cwd, name, plan, title, config, env: process.env, onProgress: createProgressPrinter() });

	await finishWorkOrderChange({ name, outcome, describe: () => [`the plan is now titled '${title}' on ticket ${name}`] });
};
