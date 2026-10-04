import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { getPlanHeadingPaths } from '#src/plan/common/paths/getPlanHeadingPaths.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
	/** The finding label: this file's basename. */
	phase: string;
	/** Every source file this plan writes that the prose-files list does not excuse. */
	coverable: string[];
}

/**
 * Coverage is checked per plan, not per file: matching a row to a file needs the
 * row to name it, and a criterion is a sentence rather than a path.
 */
export const checkLedgerCoverage = ({ plan, phase, coverable }: Params): StructuralFinding[] => {
	const findings: StructuralFinding[] = [];
	const shared = { check: StructuralCheck.LedgerCovers, severity: FindingSeverity.Blocking, phase };
	// The file headings alone, not `getPlanNamedPaths`: that list also carries the
	// ledger's own test files, and a prose exemption pointing at one of those
	// would excuse a file no heading ever claimed.
	const named = new Set(getPlanHeadingPaths({ plan }));

	// An absent section is the shape check's business when the switch is on, and
	// nobody's when it is off.
	if (plan.sections.has('Acceptance Tests') && plan.ledger.length === 0 && coverable.length > 0) {
		findings.push({
			...shared,
			issue: `the acceptance-test ledger states no criterion, while this plan writes ${coverable.length} source file(s)`,
			location: `${phase} → Acceptance Tests`,
			fix: 'add a row per acceptance criterion, or list the file under `## Prose Files` with a reason',
		});
	}

	for (const file of plan.proseFiles) {
		if (!named.has(file.path)) {
			findings.push({
				...shared,
				issue: `Prose Files names '${file.path}', which is under none of this plan's file headings`,
				location: `${phase}:${file.line}`,
				fix: 'list it under a file heading, or remove the entry',
			});
		}
	}

	return findings;
};
