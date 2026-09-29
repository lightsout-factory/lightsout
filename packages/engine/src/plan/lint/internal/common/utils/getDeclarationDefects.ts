import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { PhaseDeclaration } from '#src/plan/common/types/PhaseDeclaration.ts';

interface Params {
	/** Orphan blocks included. */
	declarations: PhaseDeclaration[];
	/** The one thing the two callers of these rules differ by. */
	locations: {
		declarationsSection: string;
		phasesTable: string;
		phaseRow: (file: string) => string;
	};
}

/**
 * Shared by both declaration checks because `getFindingSetKey` keys the repair
 * loop's no-progress detection on `check|issue`: two copies drifting by a word
 * would stop the loops recognising the same finding.
 */
export const getDeclarationDefects = ({ declarations, locations }: Params): Pick<StructuralFinding, 'issue' | 'location' | 'fix'>[] => {
	const defects: Pick<StructuralFinding, 'issue' | 'location' | 'fix'>[] = [];
	const numbered = declarations.filter((declaration) => declaration.number > 0);
	const numbers = numbered.map((declaration) => declaration.number).sort((one, other) => one - other);

	for (const declaration of declarations.filter((candidate) => candidate.number === 0)) {
		defects.push({
			issue: `'## Phase Declarations' has a block for '${declaration.file}', which the '## Phases' table does not list`,
			location: locations.declarationsSection,
			fix: `add a '## Phases' row for ${declaration.file}, or delete the orphan block`,
		});
	}

	if (numbers.some((number, index) => number !== index + 1)) {
		defects.push({
			issue: `the phase numbers are ${numbers.join(', ')} rather than 1 to ${numbers.length} with no gaps or duplicates`,
			location: locations.phasesTable,
			fix: 'renumber the phases so they run 1..n in table order',
		});
	}

	for (const declaration of numbered.filter((candidate) => !new RegExp(`^phase${candidate.number}-.+\\.md$`).test(candidate.file))) {
		defects.push({
			issue: `phase ${declaration.number} is declared in '${declaration.file}', whose name does not read phase${declaration.number}-<slug>.md`,
			location: locations.phaseRow(declaration.file),
			fix: 'rename the file or the row so the number and the filename agree',
		});
	}

	return defects;
};
