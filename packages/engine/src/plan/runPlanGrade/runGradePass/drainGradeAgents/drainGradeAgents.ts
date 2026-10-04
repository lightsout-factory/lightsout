import { basename, relative } from 'node:path';
import { buildPlanGapCheckInvocation } from '#src/agents/buildPlanGapCheckInvocation.ts';
import type { GapCheckLens } from '#src/contracts/plan/grade/GapCheckLens.ts';
import { GapCheckReport } from '#src/contracts/plan/grade/GapCheckReport.ts';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import { planAgentTimeouts } from '#src/plan/common/constants/planAgentTimeouts.ts';
import { createPlanAgentRunner } from '#src/plan/common/createPlanAgentRunner.ts';
import type { DeliverableFile } from '#src/plan/common/types/DeliverableFile.ts';
import { gapCheckLenses } from '#src/plan/runPlanGrade/common/constants/gapCheckLenses.ts';
import type { DetectionPass } from '#src/plan/runPlanGrade/common/types/DetectionPass.ts';
import type { PlanGradeParams } from '#src/plan/runPlanGrade/common/types/PlanGradeParams.ts';
import { checkPlanDocumentation } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/checkPlanDocumentation.ts';
import { phaseFindingRecords } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/common/phaseFindingRecords.ts';
import type { GapResult } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/common/types/GapResult.ts';
import { drainGapCheckers } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/drainGapCheckers.ts';
import { judgeGaps } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/judgeGaps/judgeGaps.ts';

const settledStatuses = [GradeFindingStatus.Resolved, GradeFindingStatus.Noted];

interface Params {
	params: PlanGradeParams;
	pass: DetectionPass;
	selected: DeliverableFile[];
	/** Findings no judge settled on an earlier pass: they need a ruling, not a re-read. */
	carried: GradedGap[];
	memory: GradeMemory;
	/** The caller decides it; nothing here reads the scope. */
	documentation: boolean;
	progress: (message: string) => void;
}

/** Each checker gets its own runner and transcript, because a sink shared by many agents interleaves into one unreadable file. */
const spawnGapChecker = async ({
	params,
	pass,
	file,
	lens,
	timeoutMs,
	memory,
}: {
	params: PlanGradeParams;
	pass: DetectionPass;
	file: DeliverableFile;
	lens: GapCheckLens;
	timeoutMs: number;
	memory: GradeMemory;
}): Promise<GapResult> => {
	const { cwd, driver, standards, model, effort, permissions, level } = params;
	const invokePlanAgent = createPlanAgentRunner({
		cwd,
		driver,
		workspaceDir: pass.workspaceDir,
		step: `grade-${basename(file.path, '.md')}-${lens}`,
		level,
		model,
		effort,
		permissions,
		timeoutMs,
		// Two, not one: a reader written off costs the plan file its coverage,
		// since a file is checked only when every lens returned for it.
		maxRoleAttempts: 2,
	});
	const outcome = await invokePlanAgent({
		invocation: buildPlanGapCheckInvocation({
			planText: file.text,
			overviewText: pass.overviewText,
			standards,
			// Only a phased plan has siblings to point at, and the wiring checker
			// opens one itself when a consumed name's shape is declared elsewhere.
			planDir: pass.overviewText === undefined ? undefined : relative(cwd, pass.workspaceDir),
			lens,
			settled: phaseFindingRecords({ memory, phase: basename(file.path), statuses: settledStatuses }),
		}),
		contract: GapCheckReport,
	});

	return { phase: basename(file.path), lens, outcome };
};

/**
 * The documentation check's findings never reach the judge: the checker's own
 * job is that judgment.
 *
 * `documentation` keys on the documentation checker's OWN coverage record, not
 * this pass's scope: a checker skipped for being on a narrow pass would let an
 * approval be granted having never run it since the baseline.
 *
 * Carried pending records join at the judge stage only: they are not plan files
 * anybody read, so they must not change the coverage the readers claim.
 *
 * `documentationComplete` is true too when the checker had nothing to do. It is
 * not whether that record STANDS, which is what feeds `complete`.
 */
export const drainGradeAgents = async ({
	params,
	pass,
	selected,
	carried,
	memory,
	documentation,
	progress,
}: Params): Promise<{
	gaps: GradedGap[];
	failures: string[];
	phasesChecked: string[];
	read: Array<{ phase: string; lens: GapCheckLens }>;
	rateLimited: boolean;
	documentationComplete: boolean;
}> => {
	const timeoutMs = params.timeoutMs ?? planAgentTimeouts.readerMs;
	const tasks = selected.flatMap((file) => gapCheckLenses.map((lens) => () => spawnGapChecker({ params, pass, file, lens, timeoutMs, memory })));
	const [readers, docsCheck] = await Promise.all([
		drainGapCheckers({ tasks, selected }),
		checkPlanDocumentation({
			cwd: params.cwd,
			driver: params.driver,
			level: params.level,
			name: params.name,
			workspaceDir: pass.workspaceDir,
			planPaths: pass.planPaths,
			files: pass.files,
			overviewText: pass.overviewText,
			docs: documentation ? pass.config?.docs : undefined,
			model: params.model,
			effort: params.effort,
			permissions: params.permissions,
			timeoutMs,
			onProgress: progress,
		}),
	]);
	const judged = await judgeGaps({
		...params,
		workspaceDir: pass.workspaceDir,
		overviewText: pass.overviewText,
		// Every plan file, not the readers' selection: a carried record may name a
		// file this pass weighed light or left out, and it still needs a judge.
		files: pass.files,
		gaps: [...readers.gaps, ...carried],
		skipReason: readers.rateLimited ? 'the reader fan-out hit the rate-limit wall, so no judge was spawned' : undefined,
		memory,
	});

	return {
		gaps: [...judged.gaps, ...docsCheck.gaps],
		failures: [...readers.failures, ...docsCheck.failures],
		phasesChecked: readers.phasesChecked,
		read: readers.read,
		rateLimited: readers.rateLimited || judged.rateLimited || docsCheck.rateLimited,
		documentationComplete: docsCheck.failures.length === 0,
	};
};
