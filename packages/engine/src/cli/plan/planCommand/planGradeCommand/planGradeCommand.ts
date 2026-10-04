import { bold } from '#src/cli/common/terminal/bold.ts';
import { green } from '#src/cli/common/terminal/green.ts';
import { red } from '#src/cli/common/terminal/red.ts';
import { yellow } from '#src/cli/common/terminal/yellow.ts';
import { planRunOptions } from '#src/cli/plan/planCommand/common/planRunOptions.ts';
import { printStructuralFinding } from '#src/cli/plan/planCommand/common/printStructuralFinding.ts';
import { printGradedGap } from '#src/cli/plan/planCommand/planGradeCommand/printGradedGap.ts';
import { exitCli } from '#src/common/exitCli.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import type { GradeReport } from '#src/contracts/plan/grade/GradeReport.ts';
import { PlanningStep } from '#src/contracts/plan/progress/PlanningStep.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { PlanRunStatus } from '#src/plan/common/constants/PlanRunStatus.ts';
import { getBlockingGaps } from '#src/plan/common/utils/getBlockingGaps.ts';
import { gradeMemoryPath } from '#src/plan/common/utils/gradeMemoryPath.ts';
import { gradeHistoryPath } from '#src/plan/gradeHistoryPath.ts';
import { recordPlanCommandRun } from '#src/plan/progress/recordPlanCommandRun.ts';
import { recordPlanningStep } from '#src/plan/progress/recordPlanningStep.ts';
import { runPlanGrade } from '#src/plan/runPlanGrade.ts';

interface Params {
	cwd: string;
	driver: Driver;
	name: string;
	standards: string | undefined;
	config: LightsoutConfig | undefined;
	/** The `--phase` values, already split and trimmed; absent grades every plan file. */
	phases?: string[];
}

// Relies on the phase-then-lens order the runner stamped the gaps in.
const printGaps = ({ gaps }: { gaps: GradeReport['gaps'] }) => {
	let heading: string | undefined;

	for (const gap of gaps) {
		if (gap.phase !== heading) {
			heading = gap.phase;
			console.log(bold(heading));
		}

		printGradedGap({ gap });
	}
};

const printWeights = ({ weights }: { weights: GradeReport['weights'] }) => {
	for (const { phase, weight, reasons } of weights) {
		console.log(`  weight: ${phase} — ${weight}${reasons.length > 0 ? ` (${reasons.join('; ')})` : ''}`);
	}
};

// The letter is the plan's verdict, not the step's outcome: a complete grade
// records as passed whatever its letter.
const gradeStatus = ({ result: graded }: { result: Awaited<ReturnType<typeof runPlanGrade>> }) =>
	graded.status === PlanRunStatus.PausedRateLimit
		? RunStatus.PausedRateLimit
		: graded.gradePath !== undefined && graded.grade?.complete === true
			? RunStatus.Passed
			: RunStatus.Failed;

const printScope = ({ grade, reused, memoryPath }: { grade: GradeReport; reused: boolean; memoryPath: string }) => {
	if (reused) {
		console.log(`  the recorded passing full review still covers the current inputs — nothing was re-run; delete ${memoryPath} to force a new baseline`);
		return;
	}

	const focus = grade.focusedOn.length > 0 ? ` — read ${grade.focusedOn.join(', ')}` : '';

	console.log(`  scope: ${grade.scope}${grade.scopeReason === undefined ? '' : ` — ${grade.scopeReason}`}${focus}`);
};

/**
 * Without the standing count a human cannot tell an approval this pass read the
 * whole plan for from one granted mostly on earlier readings. It prints even at
 * zero so two runs can be compared.
 */
const printCoverage = ({ grade }: { grade: GradeReport }) => {
	const stood = grade.covered.filter((phase) => !grade.phasesChecked.includes(phase) && !grade.phasesLight.includes(phase)).length;

	console.log(
		`  coverage: ${grade.covered.length} plan file(s) covered at their current text — ${grade.phasesChecked.length} read by this pass, ${stood} standing from an earlier pass`,
	);
};

/**
 * Failures are handled here rather than through `exitOnPlanFailure` because a
 * failed or parked run leaves a partial report on disk, and the helper would exit
 * before it could be printed. An incomplete pass exits 1; a complete grade exits
 * 0 whatever its verdict.
 */
export const planGradeCommand = async ({ cwd, driver, name, standards, config, phases }: Params): Promise<void> => {
	const result = await recordPlanCommandRun({
		cwd,
		name,
		label: 'plan grade',
		statusOf: gradeStatus,
		work: ({ level }) =>
			recordPlanningStep({
				cwd,
				name,
				step: PlanningStep.Grade,
				work: () => runPlanGrade({ ...planRunOptions({ cwd, driver, name, standards, config }), phases, level }),
				statusOf: gradeStatus,
			}),
	});

	if ('error' in result) {
		console.error(`\n${result.error}`);
	}

	const grade = 'grade' in result ? result.grade : undefined;
	const gradePath = 'gradePath' in result ? result.gradePath : undefined;

	if (grade === undefined || gradePath === undefined) {
		return exitCli({ code: 1 });
	}

	if (!grade.complete) {
		console.log(`\n${yellow('incomplete grade')} — ${grade.incompleteReason ?? 'the pass did not finish'}`);
	}

	// Three branches, not two: an unknown tree state must not read as a clean one.
	const treeState = grade.gradedTreeDirty === undefined ? ', tree state unknown' : grade.gradedTreeDirty ? ' plus uncommitted changes' : '';
	const measuredAgainst = grade.gradedCommit === undefined ? 'outside a git worktree' : `at ${grade.gradedCommit.slice(0, 12)}${treeState}`;

	console.log(`\n${bold(`plan grade ${name}`)} — ${grade.passed ? green(grade.grade) : red(grade.grade)} (graded ${grade.gradedAt}, ${measuredAgainst})`);

	const memoryPath = await gradeMemoryPath({ cwd, name });

	printScope({ grade, reused: 'reused' in result && result.reused === true, memoryPath });

	const blocking = getBlockingGaps({ gaps: grade.gaps });
	// Counted apart so a spike in judge failures does not read as a plan getting worse.
	const unjudged = blocking.filter((gap) => gap.outcome === GapOutcome.Unjudged).length;

	console.log(`  structural: ${grade.structural.length} · gaps: ${grade.gaps.length} (${blocking.length} blocking, ${unjudged} unjudged)`);
	// `N phase file(s)` rather than `all plan files`: overview.md is never
	// gap-checked, so the coverage line must not imply it was.
	const checked = grade.phasesChecked.length > 0 ? `: ${grade.phasesChecked.join(', ')}` : '';

	console.log(`  checked: ${grade.phasesChecked.length} phase file(s) × ${grade.lenses.length} lens(es)${checked}`);
	printCoverage({ grade });
	printWeights({ weights: grade.weights });

	for (const finding of grade.structural) {
		printStructuralFinding({ finding });
	}

	printGaps({ gaps: blocking });

	console.log(`\ngrade: ${gradePath}`);
	console.log(`history: ${await gradeHistoryPath({ cwd, name })}`);
	console.log(`memory: ${memoryPath}`);
	return exitCli({ code: grade.complete ? 0 : 1 });
};
