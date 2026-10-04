import { basename } from 'node:path';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';
import type { PhaseWeight } from '#src/contracts/plan/grade/PhaseWeight.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { GradeInputs } from '#src/contracts/plan/memory/GradeInputs.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import type { GradeScope } from '#src/contracts/plan/memory/GradeScope.ts';
import type { DeliverableFile } from '#src/plan/common/types/DeliverableFile.ts';
import { gapCheckLenses } from '#src/plan/runPlanGrade/common/constants/gapCheckLenses.ts';
import { getPhaseGraph } from '#src/plan/runPlanGrade/common/getPhaseGraph/getPhaseGraph.ts';
import type { DetectionPass } from '#src/plan/runPlanGrade/common/types/DetectionPass.ts';
import type { PlanGradeParams } from '#src/plan/runPlanGrade/common/types/PlanGradeParams.ts';
import { getPassCoverage } from '#src/plan/runPlanGrade/runGradePass/common/getPassCoverage.ts';
import { pendingFindingGaps } from '#src/plan/runPlanGrade/runGradePass/prepareGradePass/pendingFindingGaps.ts';
import { revalidateResolutions } from '#src/plan/runPlanGrade/runGradePass/prepareGradePass/revalidateResolutions.ts';
import { weighSelection } from '#src/plan/runPlanGrade/runGradePass/prepareGradePass/weighSelection/weighSelection.ts';

interface Params {
	params: PlanGradeParams;
	pass: DetectionPass;
	/** Already narrowed to the decided scope. */
	selected: DeliverableFile[];
	scope: GradeScope;
	inputs: GradeInputs;
	/** The memory as this pass found it. */
	memory: GradeMemory;
	structural: StructuralFinding[];
	at: string;
	progress: (message: string) => void;
}

/** Nothing when the graph could not be built, which invalidates every plan file. */
const phaseGraph = ({ pass }: { pass: DetectionPass }) => {
	if (pass.overviewText === undefined) {
		return new Map(pass.files.map((file) => [basename(file.path), new Set<string>()]));
	}

	const graph = getPhaseGraph({ files: pass.files, overviewText: pass.overviewText });

	return 'error' in graph ? undefined : graph.connections;
};

/**
 * The coverage is read from the memory as the pass FOUND it, so it is the same
 * answer `decideGradeScope` narrowed the readers by.
 *
 * Resolutions are revalidated before any spawn, so a record the plan no longer
 * supports is reopened in time for this very pass to re-judge it.
 */
export const prepareGradePass = async ({
	params,
	pass,
	selected,
	scope,
	inputs,
	memory,
	structural,
	at,
	progress,
}: Params): Promise<{
	/** In deliverable order. */
	planFiles: string[];
	weights: PhaseWeight[];
	heavy: DeliverableFile[];
	light: string[];
	connections?: Map<string, Set<string>>;
	found: ReturnType<typeof getPassCoverage>;
	documentation: boolean;
	memory: GradeMemory;
	carried: GradedGap[];
}> => {
	const { cwd, name } = params;
	const planFiles = pass.files.map((file) => basename(file.path));
	const { weights, heavy, light } = weighSelection({ selected, config: pass.config });
	const connections = phaseGraph({ pass });
	const found = getPassCoverage({
		phaseFiles: planFiles,
		overviewText: pass.overviewText,
		inputs,
		coverage: memory.coverage,
		connections,
		baseline: memory.lastPass?.inputs,
	});
	// The checker keys on its OWN record rather than on how far this pass reached:
	// a checker skipped for being on a narrow pass would let an approval be
	// granted having never run it.
	const documentation = found.docs === undefined;
	const revalidated = await revalidateResolutions({ cwd, files: pass.files, overviewText: pass.overviewText, memory, at });
	const carried = pendingFindingGaps({ memory: revalidated.memory });

	progress(
		`plan grade ${name}: ${scope} pass — ${structural.length} structural finding(s), gap-checking ${heavy.length} of ${pass.files.length} plan file(s) × ${gapCheckLenses.length} lens(es)${found.covered.length > 0 ? `, ${found.covered.length} plan file(s) already covered at their current text and read by nobody again` : ''}${light.length > 0 ? `, ${light.length} weighed light and read by nobody` : ''}${revalidated.reopened.length > 0 ? `, ${revalidated.reopened.length} resolved finding(s) reopened because the plan no longer states their answer` : ''}${carried.length > 0 ? `, ${carried.length} pending finding(s) carried in for a judge` : ''}`,
	);

	return { planFiles, weights, heavy, light, connections, found, documentation, memory: revalidated.memory, carried };
};
