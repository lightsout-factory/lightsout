import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import { createWorkOrder } from '#src/workOrder/createWorkOrder/createWorkOrder.ts';

/**
 * Neither `--ticket` nor `--title` is a required flag, because the pair is what
 * is required, and the creator states that rule. The name is the last line on
 * stdout because a calling skill reads that line back. It skips the record-change
 * finisher: a new record has no ship request to withdraw and no publish to report.
 */
export const workOrderNewCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const config = await readConfig({ cwd });
	const created = await createWorkOrder({
		cwd,
		ticketRef: getStringFlag({ flags, name: 'ticket' }),
		title: getStringFlag({ flags, name: 'title' }),
		config,
		env: process.env,
		onProgress: createProgressPrinter(),
	});

	if ('error' in created) {
		console.error(created.error);

		return exitCli({ code: 1 });
	}

	console.log(`work order ${created.name} implements on branch ${created.branch}`);
	console.log(created.name);

	return exitCli({ code: 0 });
};
