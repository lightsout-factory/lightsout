import { BuildMode } from '#src/common/constants/BuildMode.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { buildModeBulletLabels } from '#src/plan/common/constants/buildModeBulletLabels.ts';
import type { PhaseDeclaration } from '#src/plan/common/types/PhaseDeclaration.ts';
import type { PhaseFile } from '#src/plan/common/types/PhaseFile.ts';
import { getExportName } from '#src/plan/common/utils/getExportName.ts';
import type { PhaseSizeCounts } from '#src/plan/internal/common/types/PhaseSizeCounts.ts';
import { getCodeSpans } from '#src/plan/internal/common/utils/getCodeSpans.ts';
import { getDeclarationDefects } from '#src/plan/lint/internal/common/utils/getDeclarationDefects.ts';

interface Params {
	declarations: PhaseDeclaration[];
	/** Ordered by phase number. */
	phases: PhaseFile[];
	/** The finding label for a declaration-side defect. */
	overviewBase: string;
	/** Keyed by phase basename. */
	counts: Map<string, PhaseSizeCounts>;
}

interface Defect {
	phase: string;
	issue: string;
	location: string;
	fix: string;
}

const stamp = ({ defects }: { defects: Defect[] }): StructuralFinding[] =>
	defects.map((defect) => ({ check: StructuralCheck.DeclarationConsistent, severity: FindingSeverity.Blocking, ...defect }));

/** A declared name may appear as a backticked span or as the export name of a created path. */
const namesIn = ({ phase }: { phase: PhaseFile }) => {
	const spans = new Set<string>();

	for (const line of phase.plan.lines) {
		for (const span of getCodeSpans({ line })) {
			spans.add(span);
		}
	}

	return { spans, exports: new Set(phase.plan.createPaths.map((path) => getExportName({ path }))) };
};

const phaseSetDefects = ({ declarations, phases, overviewBase }: Omit<Params, 'counts'>) => {
	const defects: Defect[] = [];

	for (const declaration of declarations.filter((candidate) => !phases.some((phase) => phase.base === candidate.file))) {
		defects.push({
			phase: overviewBase,
			issue: `the phase breakdown declares '${declaration.file}', which is not one of this plan's phase files`,
			location: `${overviewBase} → ${declaration.file}`,
			fix: 'correct the filename, or drop the row and its declaration block',
		});
	}

	for (const phase of phases.filter((candidate) => !declarations.some((declaration) => declaration.file === candidate.base))) {
		defects.push({
			phase: phase.base,
			issue: "this phase file has no row in the overview's phase breakdown",
			location: phase.base,
			fix: `add a '## Phases' row and a '## Phase Declarations' block for ${phase.base}`,
		});
	}

	defects.push(
		...getDeclarationDefects({
			declarations,
			locations: {
				declarationsSection: `${overviewBase} → Phase Declarations`,
				phasesTable: `${overviewBase} → Phases`,
				phaseRow: (file) => `${overviewBase} → ${file}`,
			},
		}).map((defect) => ({ phase: overviewBase, ...defect })),
	);

	return defects;
};

const numberDefects = ({
	declaration,
	phase,
	overviewBase,
	counts,
}: {
	declaration: PhaseDeclaration;
	phase: PhaseFile;
	overviewBase: string;
	counts: Map<string, PhaseSizeCounts>;
}) => {
	const defects: Defect[] = [];
	const actual = counts.get(phase.base);
	const declaredCounts = [
		{ label: 'creates', declared: declaration.createdCount, real: actual?.created },
		{ label: 'touches', declared: declaration.touchedCount, real: actual?.touched },
	];

	for (const { label, declared, real } of declaredCounts) {
		if (declared === undefined) {
			defects.push({
				phase: overviewBase,
				issue: `the '${label}' count for ${declaration.file} is missing or not an integer`,
				location: `${overviewBase} → Phases`,
				fix: `state how many source files ${declaration.file} ${label}, as an integer`,
			});
		} else if (real !== undefined && declared !== real) {
			defects.push({
				phase: overviewBase,
				issue: `${declaration.file} is declared to ${label} ${declared} source files, but its own file lists ${real}`,
				location: `${overviewBase} → Phases`,
				fix: `state ${real}, or change ${declaration.file} to match the declaration`,
			});
		}
	}

	if (declaration.fileBudget !== phase.plan.fileBudget) {
		defects.push({
			phase: overviewBase,
			issue: `the file budget declared for ${declaration.file} (${declaration.fileBudget ?? 'none'}) is not its own '## File Budget' (${phase.plan.fileBudget ?? 'none'})`,
			location: `${overviewBase} → Phase Declarations`,
			fix: 'the two copies must agree — the door check reads the overview, the implementing agent is handed the phase file',
		});
	}

	// a move-folders-and-files phase is exempt from the file budget, so a budget under its touched count refuses nothing
	if (
		declaration.buildMode !== BuildMode.MoveFoldersAndFiles &&
		declaration.fileBudget !== undefined &&
		declaration.touchedCount !== undefined &&
		declaration.fileBudget < declaration.touchedCount
	) {
		defects.push({
			phase: overviewBase,
			issue: `the file budget declared for ${declaration.file} (${declaration.fileBudget}) is below its own touched count (${declaration.touchedCount})`,
			location: `${overviewBase} → Phase Declarations`,
			fix: `raise the budget to at least ${declaration.touchedCount} — a budget under the phase's own work refuses it at implement time`,
		});
	}

	return defects;
};

const nameDefects = ({ declaration, phase, overviewBase }: { declaration: PhaseDeclaration; phase: PhaseFile; overviewBase: string }) => {
	const defects: Defect[] = [];
	const { spans, exports } = namesIn({ phase });
	const written = new Set([...phase.plan.createPaths, ...phase.plan.movePaths.map((move) => move.to)]);

	for (const path of declaration.creates.filter((candidate) => !written.has(candidate))) {
		defects.push({
			phase: overviewBase,
			issue: `${declaration.file} is declared to create '${path}', which it lists under neither Files to Create nor Files to Move`,
			location: `${overviewBase} → ${declaration.file}`,
			fix: `add '${path}' to ${declaration.file}, or drop it from the declaration`,
		});
	}

	for (const name of declaration.exports.filter((candidate) => !spans.has(candidate) && !exports.has(candidate))) {
		defects.push({
			phase: overviewBase,
			issue: `${declaration.file} is declared to export '${name}', which appears nowhere in that phase file`,
			location: `${overviewBase} → ${declaration.file}`,
			fix: `have ${declaration.file} define '${name}', or drop it from the declaration`,
		});
	}

	for (const script of declaration.scripts.filter((candidate) => !spans.has(candidate))) {
		defects.push({
			phase: overviewBase,
			issue: `${declaration.file} is declared to add the script '${script}', which appears nowhere in that phase file`,
			location: `${overviewBase} → ${declaration.file}`,
			fix: `have ${declaration.file} add '${script}', or drop it from the declaration`,
		});
	}

	return defects;
};

const modeBulletAdvice = ({ buildMode }: { buildMode: BuildMode }) =>
	buildMode === BuildMode.Standard ? 'no mode bullet' : `only the '${buildModeBulletLabels[buildMode]}: yes' bullet`;

/** A block reading yes on both mode bullets is skipped here: `getDeclarationDefects` already reports it. */
const buildModeDefects = ({ declaration, phase, overviewBase }: { declaration: PhaseDeclaration; phase: PhaseFile; overviewBase: string }) => {
	const declared = declaration.buildMode ?? BuildMode.Standard;
	const own = phase.plan.buildMode;

	return declaration.buildModeConflict === true || declared === own
		? []
		: [
				{
					phase: overviewBase,
					issue: `${declaration.file} is declared with build mode '${declared}', but its own file's build mode is '${own}'`,
					location: `${overviewBase} → Phase Declarations`,
					fix: `the two copies must agree, since the implementing agent is handed the phase file — give ${declaration.file}'s declaration block ${modeBulletAdvice({ buildMode: own })}; the mechanical repair applies this`,
				},
			];
};

/**
 * The provenance check reads the phase files, so without this the overview's
 * declaration could quietly describe a plan that no longer exists.
 */
export const checkPhaseDeclarations = ({ declarations, phases, overviewBase, counts }: Params): StructuralFinding[] => {
	const defects = phaseSetDefects({ declarations, phases, overviewBase });

	for (const declaration of declarations) {
		const phase = phases.find((candidate) => candidate.base === declaration.file);

		if (phase) {
			defects.push(
				...numberDefects({ declaration, phase, overviewBase, counts }),
				...nameDefects({ declaration, phase, overviewBase }),
				...buildModeDefects({ declaration, phase, overviewBase }),
			);
		}
	}

	return stamp({ defects });
};
