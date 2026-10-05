import { basename, join } from 'node:path';
import { pathExists } from '#src/common/paths/pathExists.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
	cwd: string;
	/** Absolute. */
	planPath: string;
	/** The finding label: this file's basename. */
	phase: string;
	/** Paths a strictly earlier phase creates or moves to: in the finished repo, absent from disk today. */
	provided: Set<string>;
	/** A single plan has no predecessor to supply anything. */
	phased: boolean;
}

const locate = ({ planPath, path }: { planPath: string; path: string }) => `${basename(planPath)} → ${path}`;

const checkSuppliedPaths = async ({ plan, cwd, planPath, phase, provided }: Params) => {
	const findings: StructuralFinding[] = [];

	for (const path of [...plan.modifyPaths, ...plan.mirrorPaths]) {
		if (provided.has(path) || (await pathExists({ path: join(cwd, path) }))) {
			continue;
		}

		findings.push({
			check: StructuralCheck.PathExists,
			severity: FindingSeverity.Blocking,
			phase,
			issue: `referenced path does not exist: ${path}`,
			location: locate({ planPath, path }),
			fix: `correct the path or move it under Files to Create if it does not exist yet`,
		});
	}

	return findings;
};

const checkNewPaths = async ({ plan, cwd, planPath, phase, provided }: Params) => {
	const findings: StructuralFinding[] = [];
	const groups = [
		{ paths: plan.createPaths, label: 'Files to Create path' },
		{ paths: plan.movePaths.map((move) => move.to), label: 'Files to Move destination' },
	];

	for (const { paths, label } of groups) {
		for (const path of paths) {
			const exists = await pathExists({ path: join(cwd, path) });

			if (!exists && !provided.has(path)) {
				continue;
			}

			findings.push({
				check: StructuralCheck.PathExists,
				severity: FindingSeverity.Blocking,
				phase,
				issue: exists ? `${label} already exists: ${path}` : `an earlier phase already creates this path: ${path}`,
				location: locate({ planPath, path }),
				fix: exists ? `move it to Files to Modify, or choose a new path` : 'list it under `## Files to Modify from Earlier Phases`',
			});
		}
	}

	return findings;
};

/**
 * A phased plan's deletes and move sources may name a file an earlier phase
 * creates, so they are left to the cross-phase pass rather than judged against today's disk.
 */
const checkRemovedPaths = async ({ plan, cwd, planPath, phase, phased }: Params) => {
	const findings: StructuralFinding[] = [];

	for (const path of plan.earlierPhaseModifyPaths) {
		if (await pathExists({ path: join(cwd, path) })) {
			findings.push({
				check: StructuralCheck.PathExists,
				severity: FindingSeverity.Blocking,
				phase,
				issue: `Files to Modify from Earlier Phases path already exists: ${path}`,
				location: locate({ planPath, path }),
				fix: 'this file exists today — list it under `## Files to Modify`',
			});
		}
	}

	for (const path of phased ? [] : [...plan.deletePaths, ...plan.movePaths.map((move) => move.from)]) {
		if (!(await pathExists({ path: join(cwd, path) }))) {
			findings.push({
				check: StructuralCheck.PathExists,
				severity: FindingSeverity.Blocking,
				phase,
				issue: `referenced path does not exist: ${path}`,
				location: locate({ planPath, path }),
				fix: `correct the path — only a file that is there can be deleted or moved`,
			});
		}
	}

	return findings;
};

export const checkPlanPaths = async (params: Params): Promise<StructuralFinding[]> => [
	...(await checkSuppliedPaths(params)),
	...(await checkNewPaths(params)),
	...(await checkRemovedPaths(params)),
];
