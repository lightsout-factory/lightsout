import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import { usage } from '#src/cli/common/constants/usage.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { getPositionals } from '#src/cli/internal/common/args/getPositionals.ts';
import { workOrderAddPlanCommand } from '#src/cli/workOrder/internal/workOrderAddPlanCommand.ts';
import { workOrderExcludePlanCommand } from '#src/cli/workOrder/internal/workOrderExcludePlanCommand.ts';
import { workOrderModeCommand } from '#src/cli/workOrder/internal/workOrderModeCommand.ts';
import { workOrderNewCommand } from '#src/cli/workOrder/internal/workOrderNewCommand.ts';
import { workOrderRequestShipCommand } from '#src/cli/workOrder/internal/workOrderRequestShipCommand.ts';
import { workOrderRetitlePlanCommand } from '#src/cli/workOrder/internal/workOrderRetitlePlanCommand.ts';
import { workOrderShowCommand } from '#src/cli/workOrder/internal/workOrderShowCommand.ts';
import { workOrderSyncCommand } from '#src/cli/workOrder/internal/workOrderSyncCommand.ts';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress/parsePlanAddress.ts';
import { workOrderNameOf } from '#src/common/planAddress/workOrderNameOf.ts';

const workOrderSubcommands: Record<string, (context: CommandContext) => Promise<void>> = {
	new: workOrderNewCommand,
	'add-plan': workOrderAddPlanCommand,
	mode: workOrderModeCommand,
	'request-ship': workOrderRequestShipCommand,
	'exclude-plan': workOrderExcludePlanCommand,
	'retitle-plan': workOrderRetitlePlanCommand,
	show: workOrderShowCommand,
	sync: workOrderSyncCommand,
};

/**
 * Every subcommand acts on a whole ticket, so a plan's address given as `--name`
 * is refused here once: it would name a folder that holds no record.
 */
export const workOrderCommand = async ({ flags, rest, cwd }: CommandContext): Promise<void> => {
	const word = getPositionals({ args: rest })[0] ?? '';
	const subcommand = workOrderSubcommands[word];

	if (subcommand === undefined) {
		console.error(usage);

		return exitCli({ code: 1 });
	}

	const name = getStringFlag({ flags, name: 'name' });

	if (name !== undefined && parsePlanAddress({ name }) !== undefined) {
		console.error(
			`\`lightsout work-order ${word}\` acts on a whole ticket, so --name takes the ticket's branch rather than one plan's address — name ${workOrderNameOf({ name })} instead`,
		);

		return exitCli({ code: 1 });
	}

	await subcommand({ flags, rest, cwd });
};
