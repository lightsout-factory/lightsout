import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { PhaseFile } from '#src/plan/common/types/PhaseFile.ts';
import { getComparableTokens } from '#src/plan/internal/common/naming/getComparableTokens.ts';

interface Params {
	/** Ordered by phase number. */
	phases: PhaseFile[];
}

/**
 * Token sets rather than raw text, which would match an identifier inside a
 * longer word and count a path in unrelated prose as a claim. Only names are
 * checked; what a hand-off carries is the wiring gap-check's to compare. Blocking,
 * so a mechanical break never reaches the agent grade; the capped repair loop
 * surfaces a stubborn false positive to the human. A missing section is already
 * a `sections-present` finding, so the pair is skipped.
 */
export const checkPhaseHandoffs = ({ phases }: Params): StructuralFinding[] => {
	const findings: StructuralFinding[] = [];

	for (const [index, phase] of phases.slice(0, -1).entries()) {
		const next = phases[index + 1];
		const handedForward = phase.plan.sections.get('What Next Plan Expects');
		const claimed = next.plan.sections.get('Prerequisites');

		if (handedForward === undefined || claimed === undefined) {
			continue;
		}

		const claimedTokens = getComparableTokens({ lines: claimed });

		for (const [token, spelling] of getComparableTokens({ lines: handedForward })) {
			if (claimedTokens.has(token)) {
				continue;
			}

			findings.push({
				check: StructuralCheck.HandoffChained,
				severity: FindingSeverity.Blocking,
				phase: next.base,
				issue: `${phase.base} hands forward \`${spelling}\`, which this phase's Prerequisites never claim`,
				location: `${next.base} → Prerequisites`,
				fix: `name \`${spelling}\` in '## Prerequisites', or drop it from ${phase.base}'s '## What Next Plan Expects'`,
			});
		}
	}

	return findings;
};
