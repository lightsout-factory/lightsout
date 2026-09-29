import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

interface Params {
	/** Implementable phases only. */
	phaseCount: number;
	/** The finding label: the overview's basename. */
	overviewBase: string;
}

/**
 * Deliberately not a ceiling: splitting a plan moves its cross-phase
 * dependencies across a boundary with no overview and no check. The issue states
 * counted facts only; a predicted gap total is a number the engine cannot know.
 */
export const checkPhaseCount = ({ phaseCount, overviewBase }: Params): StructuralFinding[] => {
	const softThreshold = 8;

	if (phaseCount <= softThreshold) {
		return [];
	}

	return [
		{
			check: StructuralCheck.PhaseCount,
			severity: FindingSeverity.Advisory,
			phase: overviewBase,
			issue: `this plan has ${phaseCount} phases, so one grading pass runs ${phaseCount * 3} gap-check agents — three lenses per phase`,
			location: `${overviewBase} → Phases`,
			fix: `legal, and no phase count is refused — but every one of those ${phaseCount * 3} checkers can raise gaps you have to decide in one sitting`,
		},
	];
};
