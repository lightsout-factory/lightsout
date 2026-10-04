import { generatedPlanRegions } from '#src/plan/common/constants/generatedPlanRegions.ts';
import { parsePhaseDeclarations } from '#src/plan/common/parsePhaseDeclarations.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';
import { getPlanDesignHash } from '#src/plan/runPlanGrade/getGradeInputs/common/getPlanDesignHash.ts';

const perPhaseRegions = [generatedPlanRegions.phases, generatedPlanRegions.phaseDeclarations];

interface Params {
	overview: ParsedPlan;
	phaseFiles: string[];
}

type OverviewDesignHashes = { shared: string; attributed: Map<string, string> } | { error: string; shared: string };

const textOf = ({ overview, start, end }: { overview: ParsedPlan; start: number; end: number }) => overview.lines.slice(start - 1, end).join('\n');

/**
 * A phase's row in `## Phases` and its block in `## Phase Declarations` belong
 * in that phase's own design hash. The spans come from the line provenance
 * `parsePhaseDeclarations` records, never a second scan of the sections, which
 * could disagree with it.
 *
 * A span the engine cannot place makes the whole overview shared, which widens
 * the pass, and keeps both per-phase sections in `shared` so nothing goes
 * unmeasured.
 */
export const getOverviewDesignHashes = ({ overview, phaseFiles }: Params): OverviewDesignHashes => {
	const declarations = parsePhaseDeclarations({ plan: overview });
	const unplaceable = ({ reason }: { reason: string }): OverviewDesignHashes => ({
		error: reason,
		shared: getPlanDesignHash({ plan: overview, keepRegions: perPhaseRegions }),
	});
	const attributed = new Map<string, string>();
	const spanless: string[] = [];

	for (const { file, rowLine, blockRange } of declarations) {
		if (rowLine === undefined || blockRange === undefined) {
			spanless.push(file);

			continue;
		}

		attributed.set(file, [textOf({ overview, start: rowLine, end: rowLine }), textOf({ overview, ...blockRange })].join('\n'));
	}

	if (spanless.length > 0) {
		return unplaceable({ reason: `the overview declares ${spanless.join(', ')} with no row or no declaration block, so that span belongs to no phase` });
	}

	const foreign = [...attributed.keys()].filter((file) => !phaseFiles.includes(file));

	if (foreign.length > 0) {
		return unplaceable({ reason: `the overview credits text to ${foreign.join(', ')}, which is not a phase file of this plan` });
	}

	const undeclared = phaseFiles.filter((file) => !attributed.has(file));

	if (undeclared.length > 0) {
		return unplaceable({
			reason: `the overview declares nothing for ${undeclared.join(', ')}, so that phase file's overview text cannot be told from the shared text`,
		});
	}

	return { shared: getPlanDesignHash({ plan: overview }), attributed };
};
