import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { ParsedPlan } from '#src/plan/internal/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
	/** The finding label: this file's basename. */
	phase: string;
}

/**
 * A move's source is gone by the time the gates run. A modified test file is
 * fine, because a reviewer judges the change against the plan before any gate
 * runs, and a move's destination is where the test then lives.
 */
export const checkMovedAwayLedgerFiles = ({ plan, phase }: Params): StructuralFinding[] => {
	const findings: StructuralFinding[] = [];
	const movedAway = new Set(plan.movePaths.map((move) => move.from));

	// One finding per file rather than per row, so repeats do not bury the other
	// findings.
	const reported = new Set<string>();

	for (const row of plan.ledger) {
		if (movedAway.has(row.testFile) && !reported.has(row.testFile)) {
			reported.add(row.testFile);
			findings.push({
				check: StructuralCheck.LedgerWellFormed,
				severity: FindingSeverity.Blocking,
				phase,
				issue: `ledger row names '${row.testFile}', which this plan moves away under \`## Files to Move\` — that file does not exist when the tests run`,
				location: `${phase}:${row.line}`,
				fix: 'point the row at the move’s destination, where the test lives after the plan runs, or drop the move',
			});
		}
	}

	return findings;
};
