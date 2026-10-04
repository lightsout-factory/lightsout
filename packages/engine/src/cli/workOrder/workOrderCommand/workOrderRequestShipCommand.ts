import { getListFlag } from '#src/cli/common/args/getListFlag.ts';
import { getRequiredFlag } from '#src/cli/common/args/getRequiredFlag.ts';
import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { finishWorkOrderChange } from '#src/cli/workOrder/workOrderCommand/common/finishWorkOrderChange.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import { exitCli } from '#src/common/exitCli.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { requestWorkOrderShip } from '#src/workOrder/requestWorkOrderShip.ts';
import { withdrawWorkOrderShipRequest } from '#src/workOrder/withdrawWorkOrderShipRequest.ts';

/** Plan tokens are handed on as typed: the operation resolves a bare number or a full id against the ticket's plans. */
export const workOrderRequestShipCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const name = await getRequiredFlag({ flags, name: 'name' });
	const plans = getListFlag({ flags, name: 'plans' });
	const withdraw = flags.get('withdraw') === true;

	if ((plans !== undefined) === withdraw) {
		console.error(
			'`lightsout work-order request-ship` takes exactly one of --plans <id,id> and --withdraw: the first records a request, the second takes one back',
		);

		return exitCli({ code: 1 });
	}

	const config = await readConfig({ cwd });
	const shared = { cwd, name, config, env: process.env, onProgress: createProgressPrinter() };
	const outcome = plans === undefined ? await withdrawWorkOrderShipRequest(shared) : await requestWorkOrderShip({ ...shared, plans });

	await finishWorkOrderChange({
		name,
		outcome,
		describe: ({ record }) => [
			record.shipRequest === undefined
				? `ticket ${name} carries no ship request, so it stays open`
				: `ticket ${name} is to ship once ${record.shipRequest.planIds.join(', ')} are implemented`,
		],
	});
};
