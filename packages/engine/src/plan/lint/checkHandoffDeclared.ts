import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { PlanFileKind } from '#src/plan/internal/common/constants/PlanFileKind.ts';
import { planSentinelTokens } from '#src/plan/internal/common/constants/planSentinelTokens.ts';
import { getComparableTokens } from '#src/plan/internal/common/naming/getComparableTokens.ts';
import type { ParsedPlan } from '#src/plan/internal/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
	/** The finding label: this file's basename. */
	phase: string;
}

/**
 * Text-level rather than a backticked span, because the template's final-phase
 * spelling is a bare sentence (`None — final phase.`) with prose after the word.
 */
const declaresAbsence = ({ line }: { line: string }) => {
	const word = /^[A-Za-z]+/.exec(line.trim().replace(/^[-*]\s*/, ''))?.[0];

	return word !== undefined && planSentinelTokens.has(word);
};

/**
 * Blocking: the phase graph a narrowed re-grade reaches along is built from these
 * tokens, so a prose hand-off is a silent gap, and `checkPhaseHandoffs` passes a
 * side that yields no token. Overviews and files without the section are other
 * checks' defects. Per-file, because `lintPlanCrossPhase` returns nothing for a
 * one-file deliverable.
 */
export const checkHandoffDeclared = ({ plan, phase }: Params): StructuralFinding[] => {
	const handedForward = plan.sections.get('What Next Plan Expects');

	if (plan.variant !== PlanFileKind.Implementable || handedForward === undefined) {
		return [];
	}

	const declared = getComparableTokens({ lines: handedForward }).size > 0 || handedForward.some((line) => declaresAbsence({ line }));

	return declared
		? []
		: [
				{
					check: StructuralCheck.HandoffDeclared,
					severity: FindingSeverity.Blocking,
					phase,
					issue: "'## What Next Plan Expects' names nothing a later plan could claim and states no absence",
					location: `${phase} → What Next Plan Expects`,
					fix: 'name what this plan hands forward in a backticked span — a path or a bare identifier — or write `None` to say it hands nothing forward',
				},
			];
};
