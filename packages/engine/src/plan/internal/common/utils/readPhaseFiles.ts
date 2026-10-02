import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { PhaseFile } from '#src/plan/common/types/PhaseFile.ts';
import { parsePlan } from '#src/plan/parsePlan.ts';

interface Params {
	/** Absolute. */
	planPaths: string[];
}

/** `overview.md` precedes every phase, and a lone `plan.md` is phase one. */
const phaseNumber = ({ base }: { base: string }) => (base === 'overview.md' ? 0 : Number(/^phase(\d+)-/.exec(base)?.[1] ?? 1));

/** An unreadable file yields a finding and no `PhaseFile`, so a path the draft claimed but never wrote cannot pass silently. */
export const readPhaseFiles = async ({ planPaths }: Params): Promise<{ phases: PhaseFile[]; findings: StructuralFinding[] }> => {
	const phases: PhaseFile[] = [];
	const findings: StructuralFinding[] = [];

	for (const planPath of planPaths) {
		const content = await readFile(planPath, 'utf8').catch(() => undefined);
		const base = basename(planPath);

		if (content === undefined) {
			findings.push({
				check: StructuralCheck.SectionsPresent,
				severity: FindingSeverity.Blocking,
				phase: base,
				issue: 'plan file could not be read',
				location: planPath,
				fix: 'ensure the draft wrote the plan file at this path',
			});

			continue;
		}

		phases.push({ path: planPath, base, number: phaseNumber({ base }), plan: parsePlan({ content, base }) });
	}

	return { phases, findings };
};
