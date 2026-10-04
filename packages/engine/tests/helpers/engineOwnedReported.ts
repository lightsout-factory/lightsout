import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

/**
 * Whether the lint still reports each of the four things the engine composes.
 * The `issue` wording is human-facing copy, so the two declaration halves are
 * told apart by a loose match rather than by pinning a sentence.
 */
export const engineOwnedReported = ({ findings }: { findings: StructuralFinding[] }) => {
	const issuesFor = ({ check }: { check: StructuralCheck }) => findings.filter((finding) => finding.check === check).map((finding) => finding.issue);
	const declaration = issuesFor({ check: StructuralCheck.DeclarationConsistent });

	return {
		decisionLog: issuesFor({ check: StructuralCheck.DecisionLogCurrent }).length > 0,
		globalConstraints: issuesFor({ check: StructuralCheck.SectionsPresent }).some((issue) => issue.includes('Global Constraints')),
		phaseCounts: declaration.some((issue) => /is declared to/.test(issue)),
		phaseDeclarations: declaration.some((issue) => /file budget/.test(issue)),
	};
};
