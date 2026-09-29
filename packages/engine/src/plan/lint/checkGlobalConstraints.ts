import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { generatedPlanRegions } from '#src/plan/internal/common/constants/generatedPlanRegions.ts';
import type { ParsedPlan } from '#src/plan/internal/common/types/ParsedPlan.ts';
import { getComparableSection } from '#src/plan/lint/internal/common/utils/getComparableSection.ts';
import { renderGlobalConstraints } from '#src/plan/sections/renderGlobalConstraints.ts';

interface Params {
	plan: ParsedPlan;
	/** The finding label: this file's basename. */
	phase: string;
	/** The merged decision record, brainstorm rows first. */
	decisions: DecisionsRecord;
	/** `buildPlanSyncDecisionsCommand(...).command`. */
	syncCommand: string;
}

/**
 * Blocking, because displayed rules that disagree with the record bind an agent
 * to something nobody settled. It takes no `phased` flag: a phase file is handed
 * to an agent on its own, so every file carries the full rules rather than a
 * pointer. Pure and synchronous, so it cannot report a difference between two
 * disk reads rather than one the plan has.
 */
export const checkGlobalConstraints = ({ plan, phase, decisions, syncCommand }: Params): StructuralFinding[] => {
	const range = plan.generatedRegionRanges.get(generatedPlanRegions.globalConstraints);
	const shared = { check: StructuralCheck.GlobalConstraintsCurrent, severity: FindingSeverity.Blocking, phase } as const;
	const fix = `run \`${syncCommand}\` — the Global Constraints are composed from the saved decision records and never edited by hand`;

	if (range === undefined) {
		return [{ ...shared, issue: "no '## Global Constraints' section — the engine composes one for every plan file", location: phase, fix }];
	}

	const carried = getComparableSection({ lines: plan.lines.slice(range.start - 1, range.end) });
	const expected = getComparableSection({ lines: renderGlobalConstraints({ decisions: decisions.decisions }).split('\n') });

	return carried === expected
		? []
		: [{ ...shared, issue: 'the Global Constraints disagree with the saved decision records', location: `${phase}:${range.start}`, fix }];
};
