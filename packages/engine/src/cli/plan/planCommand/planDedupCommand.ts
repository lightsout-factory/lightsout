import { bold } from '#src/cli/common/terminal/bold.ts';
import { dim } from '#src/cli/common/terminal/dim.ts';
import { green } from '#src/cli/common/terminal/green.ts';
import { yellow } from '#src/cli/common/terminal/yellow.ts';
import { planRunOptions } from '#src/cli/plan/planCommand/common/planRunOptions.ts';
import { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import { exitCli } from '#src/common/exitCli.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PlanningStep } from '#src/contracts/plan/progress/PlanningStep.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { recordPlanCommandRun } from '#src/plan/progress/recordPlanCommandRun.ts';
import { recordPlanningStep } from '#src/plan/progress/recordPlanningStep/recordPlanningStep.ts';
import { runPlanDedup } from '#src/plan/runPlanDedup/runPlanDedup.ts';

interface Params {
	cwd: string;
	driver: Driver;
	name: string;
	standards: string | undefined;
	config: LightsoutConfig | undefined;
}

/**
 * Failures are handled here rather than through `exitOnPlanFailure` because a
 * failed judge leaves a partial report on disk, and the helper would exit before
 * it could be printed.
 */
export const planDedupCommand = async ({ cwd, driver, name, standards, config }: Params): Promise<void> => {
	const statusOf = ({ result: deduped }: { result: Awaited<ReturnType<typeof runPlanDedup>> }) =>
		deduped.status === PlanRunStatus.PausedRateLimit
			? RunStatus.PausedRateLimit
			: deduped.dedupPath !== undefined && deduped.dedup?.complete === true
				? RunStatus.Passed
				: RunStatus.Failed;
	const result = await recordPlanCommandRun({
		cwd,
		name,
		label: 'plan dedup',
		statusOf,
		work: ({ level }) =>
			recordPlanningStep({
				cwd,
				name,
				step: PlanningStep.Dedup,
				work: () => runPlanDedup({ ...planRunOptions({ cwd, driver, name, standards, config }), level }),
				statusOf,
			}),
	});

	if ('error' in result) {
		console.error(`\n${result.error}`);
	}

	const dedup = 'dedup' in result ? result.dedup : undefined;
	const dedupPath = 'dedupPath' in result ? result.dedupPath : undefined;

	if (dedup === undefined || dedupPath === undefined) {
		return exitCli({ code: 1 });
	}

	const count = dedup.findings.length;

	if (!dedup.complete) {
		console.log(`\n${yellow('incomplete scan')} — ${dedup.incompleteReason ?? 'the pass did not finish'}`);
	}

	console.log(
		`\n${bold(`plan dedup ${name}`)} — ${count > 0 ? yellow(`${count} duplication(s) to review`) : green('no duplication found')} (reviewed ${dedup.reviewedAt})`,
	);

	for (const finding of dedup.findings) {
		console.log(
			`${yellow('⧉')} ${finding.phase} · ${finding.plannedSymbol} [${finding.recommendation}] collides with ${finding.collidesWith.map((collision) => collision.path).join(', ')}`,
		);
		console.log(dim(`   ${finding.rationale}`));
	}

	console.log(`\ndedup: ${dedupPath}`);
	return exitCli({ code: dedup.complete ? 0 : 1 });
};
