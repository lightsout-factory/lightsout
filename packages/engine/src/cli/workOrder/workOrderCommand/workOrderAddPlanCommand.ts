import { getRequiredFlag } from '#src/cli/common/args/getRequiredFlag.ts';
import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { finishWorkOrderChange } from '#src/cli/workOrder/workOrderCommand/common/finishWorkOrderChange.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import { getStringFlag } from '#src/common/getStringFlag.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { addWorkOrderPlan } from '#src/workOrder/addWorkOrderPlan/addWorkOrderPlan.ts';

/** The plan's address is the last line on stdout, because a calling skill reads that line back. */
export const workOrderAddPlanCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const name = await getRequiredFlag({ flags, name: 'name' });
	const slug = await getRequiredFlag({ flags, name: 'slug' });
	const config = await readConfig({ cwd });
	const outcome = await addWorkOrderPlan({
		cwd,
		name,
		slug,
		title: getStringFlag({ flags, name: 'title' }),
		config,
		env: process.env,
		onProgress: createProgressPrinter(),
	});

	await finishWorkOrderChange({
		name,
		outcome,
		describe: ({ address, record }) => [`work order ${name} now holds ${record.plans.length} plan(s), the newest of them:`, address],
	});
};
