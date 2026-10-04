import { estimateActivityCost } from '#src/activity/estimateActivityCost.ts';
import { printActivityReport } from '#src/cli/reportCommand/printActivityReport/printActivityReport.ts';
import { resolveReportTargets } from '#src/cli/reportCommand/resolveReportTargets.ts';
import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import { usage } from '#src/common/constants/usage.ts';
import { exitCli } from '#src/common/exitCli.ts';
import { getStringFlag } from '#src/common/getStringFlag.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import type { PlanActivityReport } from '#src/common/types/PlanActivityReport.ts';
import type { ConfigPricing } from '#src/contracts/ConfigPricing.ts';
import { readPlanActivityReports } from '#src/views/readPlanActivityReports.ts';

// Absent rather than zero when no root could be priced, so a repository with no
// rates carries no estimate.
const estimateOf = ({ plan, pricing }: { plan: PlanActivityReport; pricing?: ConfigPricing }) => {
	const priced = (plan.report?.roots ?? []).flatMap((node) => {
		const estimate = estimateActivityCost({ node, pricing });

		return estimate === undefined ? [] : [estimate];
	});

	return priced.length === 0 ? undefined : priced.reduce((total, dollars) => total + dollars, 0);
};

/**
 * `--json` prints the totalled tree rather than formatted strings, so a consumer
 * reads the same calculation the table does.
 *
 * The config is optional: a report is never withheld for want of a price list.
 */
export const reportCommand = async ({ cwd, flags }: CommandContext): Promise<void> => {
	const name = getStringFlag({ flags, name: 'plan' });

	if (name === undefined) {
		console.error(usage);
		return exitCli({ code: 1 });
	}

	const resolved = await resolveReportTargets({ cwd, name });

	if ('error' in resolved) {
		console.error(resolved.error);
		return exitCli({ code: 1 });
	}

	const pricing = (await readOptionalConfig({ cwd }))?.pricing;
	const plans = await readPlanActivityReports({ cwd, names: resolved.names });

	if (flags.get('json') === true) {
		console.log(
			JSON.stringify(
				{
					target: name,
					workOrderFolder: resolved.workOrderFolder,
					plans: plans.map((plan) => ({ name: plan.name, report: plan.report, estimatedCostUsd: estimateOf({ plan, pricing }) })),
				},
				null,
				2,
			),
		);

		return exitCli({ code: 0 });
	}

	printActivityReport({ target: name, workOrderFolder: resolved.workOrderFolder, plans, pricing });

	return exitCli({ code: 0 });
};
