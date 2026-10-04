import { getRequiredFlag } from '#src/cli/common/args/getRequiredFlag.ts';
import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { bold } from '#src/cli/common/terminal/bold.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import { exitCli } from '#src/common/exitCli.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { PlanningStep } from '#src/contracts/plan/progress/PlanningStep.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { recordPlanCommandRun } from '#src/plan/progress/recordPlanCommandRun.ts';
import { recordPlanningStep } from '#src/plan/progress/recordPlanningStep.ts';
import { publishWorkOrderPlan } from '#src/workOrder/publishWorkOrderPlan/publishWorkOrderPlan.ts';

interface PlanPublishOutcome {
	ticketRef?: string;
	published: string[];
	stale: string[];
	error?: string;
	/** Set by the work order publisher when the plan's files landed but `state.json` does not say so. */
	recordError?: string;
}

/**
 * The config is read with `readConfig`, not the optional reader: publishing needs
 * a `ticket-tracker` block, so a repo with no config is refused.
 *
 * A stale attachment does not change the exit code: the manifest committed last
 * selects the new generation, so it is harmless. A record that could not be
 * written fails the step, because nothing on the ticket then says which
 * generation the landed files are.
 */
export const planPublishCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const name = await getRequiredFlag({ flags, name: 'name' });
	const config = await readConfig({ cwd });
	const statusOf = ({ result }: { result: PlanPublishOutcome }) =>
		result.error === undefined && result.recordError === undefined ? RunStatus.Passed : RunStatus.Failed;
	// Wrapped after the refusals above, so a command that refuses opens no level.
	const report = await recordPlanCommandRun({
		cwd,
		name,
		label: 'plan publish',
		statusOf,
		work: () =>
			recordPlanningStep({
				cwd,
				name,
				step: PlanningStep.Publish,
				work: (): Promise<PlanPublishOutcome> => publishWorkOrderPlan({ cwd, address: name, config, env: process.env, onProgress: createProgressPrinter() }),
				statusOf,
			}),
	});

	if (report.error !== undefined) {
		console.error(`\n${report.error}`);
		return exitCli({ code: 1 });
	}

	console.log(`\n${bold(`plan publish ${name}`)} — ${report.published.length} file(s) attached to ${report.ticketRef}`);

	for (const file of report.published) {
		console.log(`  ${file}`);
	}

	if (report.stale.length > 0) {
		console.log(`\nstill on ${report.ticketRef} from an earlier publish, and not written by this run: ${report.stale.join(', ')} — publish deleted nothing.`);
	}

	if (report.recordError !== undefined) {
		console.error(`\n${report.recordError}`);
		return exitCli({ code: 1 });
	}

	return exitCli({ code: 0 });
};
