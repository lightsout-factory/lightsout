import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { getRequiredFlag } from '#src/cli/internal/common/args/getRequiredFlag.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import { WorkOrderSyncKeep } from '#src/workOrder/common/constants/WorkOrderSyncKeep.ts';
import { syncWorkOrderState } from '#src/workOrder/syncWorkOrderState.ts';

/** With no `--keep` this is the ordinary pull, which is also how a failed publish is retried. */
export const workOrderSyncCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const name = await getRequiredFlag({ flags, name: 'name' });
	const asked = getStringFlag({ flags, name: 'keep' });
	const keep = Object.values(WorkOrderSyncKeep).find((candidate) => candidate === asked);

	if (asked !== undefined && keep === undefined) {
		console.error(`--keep takes ${Object.values(WorkOrderSyncKeep).join(' or ')}, and '${asked}' is neither`);

		return exitCli({ code: 1 });
	}

	const config = await readConfig({ cwd });
	const synced = await syncWorkOrderState({ cwd, name, config, env: process.env, keep, onProgress: createProgressPrinter() });

	if ('error' in synced) {
		console.error(synced.error);

		return exitCli({ code: 1 });
	}

	// `sync` refuses a work order with nowhere to publish to, so the reference is
	// always set here; checking it keeps that guarantee stated rather than assumed.
	const carrier = synced.record.ticketRef === undefined ? '' : ` on ${synced.record.ticketRef}`;

	console.log(
		keep === undefined
			? `the record for work order ${synced.record.name} and the copy${carrier} are in sync`
			: `the ${keep} copy of ${name}'s record is now the one on both sides`,
	);

	return exitCli({ code: 0 });
};
