import { getRequiredFlag } from '#src/cli/common/args/getRequiredFlag.ts';
import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { describePlanProgress } from '#src/cli/workOrder/workOrderCommand/workOrderShowCommand/describePlanProgress.ts';
import { describeWorkOrderShipState } from '#src/cli/workOrder/workOrderCommand/workOrderShowCommand/describeWorkOrderShipState.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import { describeMissingWorkOrder } from '#src/common/describeMissingWorkOrder.ts';
import { exitCli } from '#src/common/exitCli.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { pullWorkOrderState } from '#src/workOrder/pullWorkOrderState.ts';
import { readWorkOrderShipState } from '#src/workOrder/shipping/readWorkOrderShipState.ts';

const renderWorkOrderState = ({ record }: { record: WorkOrderState }) => [
	// The label leads, because it is what every other subcommand is typed with;
	// the branch follows, because a prefixed one cannot be read off the label.
	`work order ${record.name} on branch ${record.branch} — ${record.mode} mode${record.ticketRef === undefined ? '' : ` — ${record.ticketRef}`}`,
	...record.plans.map((plan) => {
		const excluded = plan.exclusion === undefined ? '' : ` — excluded: ${plan.exclusion.reason}`;

		return `  ${plan.id} — ${plan.title} — ${describePlanProgress({ progress: plan.progress })}${excluded}`;
	}),
	// A work order holding no plan 001 ships on its build from the ticket body, so that build is shown like a plan.
	...(record.ticketBodyBuild === undefined ? [] : [`  built from the ticket body — ${describePlanProgress({ progress: record.ticketBodyBuild.progress })}`]),
	// One line from the same reader the ship check decides from, so the two never disagree.
	describeWorkOrderShipState({ name: record.name, state: readWorkOrderShipState({ record }) }),
];

/**
 * The record is pulled rather than read, so a copy another machine published is
 * taken first and a divergence is reported instead of a stale answer.
 */
export const workOrderShowCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const name = await getRequiredFlag({ flags, name: 'name' });
	const config = await readConfig({ cwd });
	const pulled = await pullWorkOrderState({ cwd, name, config, env: process.env, onProgress: createProgressPrinter() });

	if ('error' in pulled) {
		console.error(pulled.error);

		return exitCli({ code: 1 });
	}

	if (pulled.record === undefined) {
		console.error(describeMissingWorkOrder({ name }));

		return exitCli({ code: 1 });
	}

	for (const line of renderWorkOrderState({ record: pulled.record })) {
		console.log(line);
	}

	return exitCli({ code: 0 });
};
