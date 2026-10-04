import { bold } from '#src/cli/common/terminal/bold.ts';
import { green } from '#src/cli/common/terminal/green.ts';
import { red } from '#src/cli/common/terminal/red.ts';
import { yellow } from '#src/cli/common/terminal/yellow.ts';
import { planRunOptions } from '#src/cli/plan/planCommand/common/planRunOptions.ts';
import { printStructuralFinding } from '#src/cli/plan/planCommand/common/printStructuralFinding.ts';
import { exitOnPlanFailure } from '#src/cli/plan/planCommand/planDraftCommand/exitOnPlanFailure.ts';
import { exitCli } from '#src/common/exitCli.ts';
import { getStringFlag } from '#src/common/getStringFlag.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PlanVariant } from '#src/contracts/plan/draft/PlanVariant.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { PlanningStep } from '#src/contracts/plan/progress/PlanningStep.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { PlanRunStatus } from '#src/plan/common/constants/PlanRunStatus.ts';
import { getBlockingFindings } from '#src/plan/common/utils/getBlockingFindings.ts';
import { runPlanDraft } from '#src/plan/draft/runPlanDraft.ts';
import { recordPlanCommandRun } from '#src/plan/progress/recordPlanCommandRun.ts';
import { recordPlanningStep } from '#src/plan/progress/recordPlanningStep.ts';

interface Params {
	cwd: string;
	driver: Driver;
	name: string;
	standards: string | undefined;
	config: LightsoutConfig | undefined;
	flags: Map<string, string | true>;
}

// Advisories gate nothing, so they are printed on every outcome or never read at all.
const printPlanAdvisories = ({ advisories }: { advisories: StructuralFinding[] }) => {
	for (const finding of advisories) {
		printStructuralFinding({ finding });
	}
};

export const planDraftCommand = async ({ cwd, driver, name, standards, config, flags }: Params): Promise<void> => {
	const scopeFlag = getStringFlag({ flags, name: 'scope' });
	const scope = scopeFlag === 'phased' ? PlanVariant.Overview : scopeFlag === 'single' ? PlanVariant.Single : undefined;
	const statusOf = ({ result }: { result: Awaited<ReturnType<typeof runPlanDraft>> }) =>
		result.status === PlanRunStatus.Complete
			? RunStatus.Passed
			: result.status === PlanRunStatus.PausedRateLimit
				? RunStatus.PausedRateLimit
				: RunStatus.Failed;
	const drafted = await recordPlanCommandRun({
		cwd,
		name,
		label: 'plan draft',
		statusOf,
		work: ({ level }) =>
			recordPlanningStep({
				cwd,
				name,
				step: PlanningStep.Draft,
				work: () => runPlanDraft({ ...planRunOptions({ cwd, driver, name, standards, config }), scope, level }),
				statusOf,
			}),
	});
	const result = await exitOnPlanFailure({ result: drafted });

	if (result.status === PlanRunStatus.FactsError) {
		console.error(`\n${red('facts error')} — the plan-writer found the facts/decisions do not match the codebase. Re-explore, then re-draft:`);

		for (const discrepancy of result.discrepancies) {
			console.error(`  ${yellow('⚠')} ${discrepancy}`);
		}

		printPlanAdvisories({ advisories: result.advisories });

		return exitCli({ code: 1 });
	}

	if (result.status === PlanRunStatus.StructuralIssues) {
		const blocking = getBlockingFindings({ findings: result.findings });

		console.error(`\n${red(`${blocking.length} structural issue(s)`)} remain after re-drafting — resolve, then re-draft:`);

		for (const finding of blocking) {
			printStructuralFinding({ finding, write: console.error });
		}

		printPlanAdvisories({ advisories: result.advisories });

		return exitCli({ code: 1 });
	}

	console.log(`\n${bold(`plan draft ${name}`)} — ${result.variant}, structurally clean`);

	for (const path of result.planPaths) {
		console.log(`  ${green('✓')} ${path}`);
	}

	printPlanAdvisories({ advisories: result.advisories });

	return exitCli({ code: 0 });
};
