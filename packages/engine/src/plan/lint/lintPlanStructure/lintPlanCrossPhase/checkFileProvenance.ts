import { join } from 'node:path';
import { pathExists } from '#src/common/pathExists.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { PhaseFile } from '#src/plan/common/types/PhaseFile.ts';
import type { PhaseProvenance } from '#src/plan/common/types/PhaseProvenance.ts';
import type { CrossPhaseLintResult } from '#src/plan/lint/lintPlanStructure/lintPlanCrossPhase/common/types/CrossPhaseLintResult.ts';

interface Params {
	cwd: string;
	/** Ordered by phase number. */
	phases: PhaseFile[];
	provenance: PhaseProvenance;
}

interface Defect {
	path: string;
	issue: string;
	fix: string;
}

const stamp = ({ phase, defects }: { phase: PhaseFile; defects: Defect[] }): StructuralFinding[] =>
	defects.map(({ path, issue, fix }) => ({
		check: StructuralCheck.FileProvenance,
		severity: FindingSeverity.Blocking,
		phase: phase.base,
		issue,
		location: `${phase.base} → ${path}`,
		fix,
	}));

const removedDefects = ({ phase, removedBefore, removedBy }: { phase: PhaseFile; removedBefore: Set<string>; removedBy: Map<string, string> }) =>
	[...phase.plan.modifyPaths, ...phase.plan.earlierPhaseModifyPaths, ...phase.plan.deletePaths]
		.filter((path) => removedBefore.has(path))
		.map((path) => ({
			path,
			issue: `path is gone by this phase: ${removedBy.get(path) ?? 'an earlier phase'} already deletes or moves it away`,
			fix: 'drop this path, or have a phase recreate it before this one touches it',
		}));

/** A path an earlier phase removed is left to `removedDefects`, the rule that knows why it is missing. */
const unsuppliedModifyDefects = ({ phase, providedBefore, removedBefore }: { phase: PhaseFile; providedBefore: Set<string>; removedBefore: Set<string> }) =>
	phase.plan.earlierPhaseModifyPaths
		.filter((path) => !providedBefore.has(path) && !removedBefore.has(path))
		.map((path) => ({
			path,
			issue: 'no earlier phase creates this path',
			fix: 'list it under `## Files to Modify` if it exists today, or have an earlier phase create it',
		}));

const earlierPhaseDefects = ({ phase, providedBefore }: { phase: PhaseFile; providedBefore: Set<string> }) =>
	phase.plan.modifyPaths
		.filter((path) => providedBefore.has(path))
		.map((path) => ({
			path,
			issue: 'this file does not exist yet — an earlier phase creates it',
			fix: 'list it under `## Files to Modify from Earlier Phases`',
		}));

/** Skipped when a removal falls between the two creates: the later one is then a recreate, not a collision. */
const collisionDefects = ({ phase, phases, provenance }: { phase: PhaseFile; phases: PhaseFile[]; provenance: PhaseProvenance }) => {
	const order = ({ base }: { base: string }) => phases.findIndex((candidate) => candidate.base === base);

	return [...phase.plan.createPaths, ...phase.plan.movePaths.map((move) => move.to)]
		.filter((path) => {
			const creator = provenance.createdBy.get(path);

			if (creator === undefined || creator === phase.base) {
				return false;
			}

			const later = order({ base: creator }) > order({ base: phase.base }) ? creator : phase.base;

			return !(provenance.removedBefore.get(later) ?? new Set<string>()).has(path);
		})
		.map((path) => ({
			path,
			issue: `two phases create this path: ${provenance.createdBy.get(path)} creates it too`,
			fix: 'let one phase create it and have the other list it under `## Files to Modify from Earlier Phases`',
		}));
};

/** A path an earlier phase already removed is `removedDefects`' to report, not this one's. */
const missingRemovalDefects = async ({
	cwd,
	phase,
	providedBefore,
	removedBefore,
}: {
	cwd: string;
	phase: PhaseFile;
	providedBefore: Set<string>;
	removedBefore: Set<string>;
}) => {
	const defects: Defect[] = [];

	for (const path of [...phase.plan.deletePaths, ...phase.plan.movePaths.map((move) => move.from)]) {
		if (providedBefore.has(path) || removedBefore.has(path) || (await pathExists({ path: join(cwd, path) }))) {
			continue;
		}

		defects.push({
			path,
			issue: 'nothing supplies this path: it is not on disk and no earlier phase creates it',
			fix: 'correct the path — only a file that is there can be deleted or moved',
		});
	}

	return defects;
};

/**
 * Reads the phase files rather than the overview's declaration: every phase file
 * is on disk by lint time, which makes provenance exactly decidable. It is the
 * only check that knows which creates an earlier phase removed, so it alone
 * produces `clearedCreates`, which `lintPlanStructure` uses to drop a
 * `path-exists` finding for a delete-then-recreate.
 */
export const checkFileProvenance = async ({ cwd, phases, provenance }: Params): Promise<CrossPhaseLintResult> => {
	const findings: StructuralFinding[] = [];
	const clearedCreates = new Set<string>();

	for (const phase of phases) {
		const providedBefore = provenance.providedBefore.get(phase.base) ?? new Set<string>();
		const removedBefore = provenance.removedBefore.get(phase.base) ?? new Set<string>();

		findings.push(
			...stamp({
				phase,
				defects: [
					...earlierPhaseDefects({ phase, providedBefore }),
					...removedDefects({ phase, removedBefore, removedBy: provenance.removedBy }),
					...unsuppliedModifyDefects({ phase, providedBefore, removedBefore }),
					...(await missingRemovalDefects({ cwd, phase, providedBefore, removedBefore })),
					...collisionDefects({ phase, phases, provenance }),
				],
			}),
		);

		for (const path of phase.plan.createPaths.filter((candidate) => removedBefore.has(candidate))) {
			clearedCreates.add(`${phase.base}|${path}`);
		}
	}

	return { findings, clearedCreates };
};
