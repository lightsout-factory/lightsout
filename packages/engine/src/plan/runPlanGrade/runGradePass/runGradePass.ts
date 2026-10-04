import { basename, join } from 'node:path';
import { writeJsonFile } from '#src/common/writeJsonFile.ts';
import { ActivityLevelKind } from '#src/contracts/activity/ActivityLevelKind.ts';
import type { GradeReport } from '#src/contracts/plan/grade/GradeReport.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { GradeInputs } from '#src/contracts/plan/memory/GradeInputs.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import type { GradeScope } from '#src/contracts/plan/memory/GradeScope.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { gradeFileName } from '#src/plan/common/constants/gradeFileName.ts';
import type { DeliverableFile } from '#src/plan/common/types/DeliverableFile.ts';
import { appendGradeHistory } from '#src/plan/runPlanGrade/common/appendGradeHistory.ts';
import { createGradeReport } from '#src/plan/runPlanGrade/common/createGradeReport.ts';
import type { DetectionPass } from '#src/plan/runPlanGrade/common/types/DetectionPass.ts';
import type { GradeStamp } from '#src/plan/runPlanGrade/common/types/GradeStamp.ts';
import type { PlanGradeParams } from '#src/plan/runPlanGrade/common/types/PlanGradeParams.ts';
import { collapseGroupedGaps } from '#src/plan/runPlanGrade/runGradePass/collapseGroupedGaps.ts';
import { drainGradeAgents } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/drainGradeAgents.ts';
import { mergeFindingRecords } from '#src/plan/runPlanGrade/runGradePass/mergeFindingRecords/mergeFindingRecords.ts';
import { openFindingGaps } from '#src/plan/runPlanGrade/runGradePass/openFindingGaps.ts';
import { prepareGradePass } from '#src/plan/runPlanGrade/runGradePass/prepareGradePass/prepareGradePass.ts';
import { recordPassCoverage } from '#src/plan/runPlanGrade/runGradePass/recordPassCoverage/recordPassCoverage.ts';
import { verifyOpenFindings } from '#src/plan/runPlanGrade/runGradePass/verifyOpenFindings/verifyOpenFindings.ts';
import { writeGradeMemory } from '#src/plan/runPlanGrade/runGradePass/writeGradeMemory.ts';

interface Params {
	params: PlanGradeParams;
	pass: DetectionPass;
	/** Already narrowed to the decided scope. */
	selected: DeliverableFile[];
	scope: GradeScope;
	/** Empty on a full pass. */
	focusedOn: string[];
	scopeReason: string;
	inputs: GradeInputs;
	/** The memory as this pass found it. */
	memory: GradeMemory;
	structural: StructuralFinding[];
	stamp: GradeStamp;
	progress: (message: string) => void;
}

/**
 * A pass that lost a reader never read that phase's text, so it cannot vouch for
 * it and must not shrink the next pass's scope.
 *
 * A focused pass may store the WHOLE input fingerprint because, by invariant,
 * the only inputs it differs from its baseline by are ones it read or that the
 * coverage record already covers at their current text.
 *
 * `complete` means every plan file is covered at its current text, which is a
 * full review however few files this one pass read.
 */
const nextBaselines = ({ memory, report, inputs, at }: { memory: GradeMemory; report: GradeReport; inputs: GradeInputs; at: string }) => ({
	lastPass: report.scopeComplete ? { scope: report.scope, inputs, at } : memory.lastPass,
	lastPassingFullReview: report.complete && report.passed ? { inputs, at } : memory.lastPassingFullReview,
});

/**
 * Written whatever the outcome: the engine gives up on a rate limit with no
 * retry, so discarding the pass would waste every spawn that did finish. The
 * coverage fields are what make a partial record safe to keep.
 */
const persistPass = async ({
	cwd,
	name,
	workspaceDir,
	report,
	memory,
}: {
	cwd: string;
	name: string;
	workspaceDir: string;
	report: GradeReport;
	memory: GradeMemory;
}) => {
	await writeJsonFile({ path: join(workspaceDir, gradeFileName), value: report });
	await appendGradeHistory({ cwd, name, report });
	await writeGradeMemory({ cwd, name, memory });
};

/**
 * The order inside is load-bearing. Every record still open joins the gap list
 * after this pass's findings are folded in, which keeps a blocker blocking when
 * no reader reported it again. `recordPassCoverage` runs before the verdict is
 * built, because the verdict speaks for the whole plan and must see what this
 * pass just read.
 *
 * The pass level is SUBSTITUTED into the params object, so the judge — called
 * with a spread of that same object — lands on the pass too.
 */
export const runGradePass = async (args: Params): Promise<{ report: GradeReport; memory: GradeMemory; rateLimited: boolean; failures: string[] }> => {
	const { params, pass, scope, focusedOn, scopeReason, inputs, structural, stamp, progress } = args;
	const { cwd, name, phases } = params;
	const passLevel = params.level?.open({ level: ActivityLevelKind.Pass, label: `${scope} pass` });
	const passParams = { ...params, level: passLevel };
	const passArgs = { ...args, params: passParams };
	const at = new Date().toISOString();
	const { planFiles, weights, heavy, light, connections, found, documentation, memory: opened, carried } = await prepareGradePass({ ...passArgs, at });
	const agents = await drainGradeAgents({ params: passParams, pass, selected: heavy, carried, memory: opened, documentation, progress });
	const verified = await verifyOpenFindings({
		...passParams,
		workspaceDir: pass.workspaceDir,
		overviewText: pass.overviewText,
		files: pass.files,
		memory: opened,
		at,
		skipReason: agents.rateLimited ? 'the reader fan-out hit the rate-limit wall, so no finding was re-verified' : undefined,
		// The same value the reader selection narrowed by, never a second closure
		// that could disagree with it.
		invalidated: found.invalidated,
	});
	const merged = mergeFindingRecords({ memory: verified.memory, gaps: agents.gaps, at });
	const { coverage, standing } = recordPassCoverage({
		planFiles,
		overviewText: pass.overviewText,
		inputs,
		standing: found.readers,
		docs: found.docs,
		read: agents.read,
		light,
		connections,
		documentationChecked: documentation && agents.documentationComplete,
		// A `--phase` narrowing records nothing: writing entries from it is the one
		// way it could buy an approval.
		narrowed: phases !== undefined,
		at,
	});
	// Collapsed after the open records join, so a pass finding and the surfaced
	// record it belongs to reach the report as one repair item.
	const gaps = collapseGroupedGaps({ gaps: [...merged.gaps, ...openFindingGaps({ memory: merged.memory, gaps: merged.gaps, refusals: verified.refusals })] });
	const report = createGradeReport({
		...stamp,
		name,
		phases,
		structural,
		gaps,
		failures: agents.failures,
		phasesChecked: agents.phasesChecked,
		weights,
		phasesLight: light,
		scope,
		focusedOn,
		inputs,
		scopeReason,
		phasesRequired: heavy.map((file) => basename(file.path)),
		documentationComplete: agents.documentationComplete,
		planFiles,
		covered: standing.covered,
		documentationCovered: standing.docs !== undefined,
	});
	const nextMemory: GradeMemory = { ...merged.memory, coverage, ...nextBaselines({ memory: merged.memory, report, inputs, at }), updatedAt: at };

	await persistPass({ cwd, name, workspaceDir: pass.workspaceDir, report, memory: nextMemory });

	const rateLimited = agents.rateLimited || verified.rateLimited;

	passLevel?.close({ outcome: rateLimited ? RunStatus.PausedRateLimit : agents.failures.length > 0 ? RunStatus.Failed : RunStatus.Passed });
	return { report, memory: nextMemory, rateLimited, failures: agents.failures };
};
