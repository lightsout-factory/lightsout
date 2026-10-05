import { BuildMode } from '#src/common/constants/BuildMode.ts';
import { touchedFileCeiling } from '#src/common/constants/touchedFileCeiling.ts';
import type { PhaseDeclaration } from '#src/common/types/PhaseDeclaration.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { buildModeBulletLabels } from '#src/plan/common/constants/buildModeBulletLabels.ts';
import { createdFileCeiling } from '#src/plan/common/constants/createdFileCeiling.ts';
import { getDeclarationDefects } from '#src/plan/common/phases/getDeclarationDefects.ts';
import { parsePhaseDeclarations } from '#src/plan/common/phases/parsePhaseDeclarations.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';
import { checkPhaseCount } from '#src/plan/lint/common/checkPhaseCount.ts';
import { parsePlan } from '#src/plan/parsePlan/parsePlan.ts';

interface Params {
	overviewText: string;
	/** The overview's basename: every finding's phase label. */
	overviewBase: string;
	/** Already defaulted by the caller. */
	executorFileLimit: number;
}

interface Defect {
	check: StructuralCheck;
	severity: StructuralFinding['severity'];
	issue: string;
	location: string;
	fix: string;
}

/**
 * Read from the section text rather than the parsed rows: an absent block parses
 * the same as one whose bullets all read `none`, and only one of those is a defect.
 */
const declaredBlockFiles = ({ plan }: { plan: ParsedPlan }) => {
	const files = new Set<string>();

	for (const line of plan.sections.get('Phase Declarations') ?? []) {
		const header = /^###\s+Phase\s+\d+\s*[—–-]\s*`([^`]+)`/.exec(line);

		if (header) {
			files.add(header[1].trim());
		}
	}

	return files;
};

const sectionDefects = ({ plan, declarations }: { plan: ParsedPlan; declarations: PhaseDeclaration[] }) => {
	const defects: Defect[] = [];
	const shared = { check: StructuralCheck.SectionsPresent, severity: FindingSeverity.Blocking };

	if (declarations.length === 0) {
		defects.push({
			...shared,
			issue: "the '## Phases' table declares no phases",
			location: 'Phases',
			fix: "write one '## Phases' row per phase: its number, its `phase<N>-<slug>.md` filename, a one-line scope, and its Creates and Touches counts",
		});

		return defects;
	}

	const blocks = declaredBlockFiles({ plan });

	for (const declaration of declarations.filter((candidate) => !blocks.has(candidate.file))) {
		defects.push({
			...shared,
			issue: `'## Phase Declarations' has no block for ${declaration.file}`,
			location: 'Phase Declarations',
			fix: `add a '### Phase ${declaration.number} — \`${declaration.file}\`' block with its Creates, Exports and Scripts bullets`,
		});
	}

	return defects;
};

const shapeDefects = ({ declarations }: { declarations: PhaseDeclaration[] }) =>
	getDeclarationDefects({
		declarations,
		locations: {
			declarationsSection: 'Phase Declarations',
			phasesTable: 'Phases',
			phaseRow: (file) => `Phases → ${file}`,
		},
	}).map((defect) => ({ check: StructuralCheck.DeclarationConsistent, severity: FindingSeverity.Blocking, ...defect }));

/**
 * The only size check that runs before any phase file exists, so a count that
 * cannot be read stops the run rather than waving the phase through. Both
 * mechanical modes are exempt from the touched ceiling, and a
 * move-folders-and-files phase from its file budget too; a block declaring both
 * modes declares neither, so the ceiling still binds it.
 */
const sizeDefects = ({ declarations, executorFileLimit }: { declarations: PhaseDeclaration[]; executorFileLimit: number }) => {
	const defects: Defect[] = [];

	for (const declaration of declarations) {
		const { file, createdCount, touchedCount, fileBudget, buildMode } = declaration;
		const budget = fileBudget ?? executorFileLimit;

		for (const { label } of [
			{ label: 'Creates', count: createdCount },
			{ label: 'Touches', count: touchedCount },
		].filter((cell) => cell.count === undefined)) {
			defects.push({
				check: StructuralCheck.DeclarationConsistent,
				severity: FindingSeverity.Blocking,
				issue: `the '${label}' count for ${file} is missing or not an integer`,
				location: 'Phases',
				fix: `state how many source files ${file} ${label === 'Creates' ? 'creates' : 'touches'}, as an integer`,
			});
		}

		if (createdCount !== undefined && createdCount > createdFileCeiling) {
			defects.push({
				check: StructuralCheck.CreatedFilesWithinCeiling,
				severity: FindingSeverity.Blocking,
				issue: `${file} is declared to create ${createdCount} source files, over the ${createdFileCeiling}-file ceiling`,
				location: `Phases → ${file}`,
				fix: `split this phase into two in the '## Phases' table and '## Phase Declarations'`,
			});
		}

		if (touchedCount !== undefined && touchedCount > touchedFileCeiling && buildMode === undefined) {
			defects.push({
				check: StructuralCheck.TouchedFilesWithinCeiling,
				severity: FindingSeverity.Blocking,
				issue: `${file} is declared to touch ${touchedCount} source files, over the ${touchedFileCeiling}-file ceiling`,
				location: `Phases → ${file}`,
				fix: `split this phase in the '## Phases' table and '## Phase Declarations' so each touches no more than ${touchedFileCeiling} files — or declare it with the '- **${buildModeBulletLabels[BuildMode.RenamesOnly]}:** yes' bullet if its whole work is renaming, or the '- **${buildModeBulletLabels[BuildMode.MoveFoldersAndFiles]}:** yes' bullet if its whole work is moving folders and files`,
			});
		}

		if (touchedCount !== undefined && touchedCount > budget && buildMode !== BuildMode.MoveFoldersAndFiles) {
			const source = fileBudget === undefined ? 'the configured executor-file-limit' : `${file}'s own declared file budget`;

			defects.push({
				check: StructuralCheck.ScopeWithinGuardrail,
				severity: FindingSeverity.Advisory,
				issue: `${file} is declared to touch ${touchedCount} source files, over the ${budget}-file limit from ${source}`,
				location: `Phases → ${file}`,
				fix: `legal, but the implementing agent stops at ${budget} files — a mostly-mechanical phase should declare a file budget covering its real touched count`,
			});
		}
	}

	return defects;
};

/**
 * Runs right after the overview spawn, before any phase file is drafted: the
 * cheapest moment a plan can be refused.
 */
export const checkPhaseBreakdown = ({ overviewText, overviewBase, executorFileLimit }: Params): StructuralFinding[] => {
	const plan = parsePlan({ content: overviewText, base: overviewBase });
	const declarations = parsePhaseDeclarations({ plan });
	const defects = [...sectionDefects({ plan, declarations }), ...shapeDefects({ declarations }), ...sizeDefects({ declarations, executorFileLimit })];

	return [
		...defects.map((defect) => ({ ...defect, phase: overviewBase, location: `${overviewBase} → ${defect.location}` })),
		...checkPhaseCount({ phaseCount: declarations.filter((declaration) => declaration.number > 0).length, overviewBase }),
	];
};
