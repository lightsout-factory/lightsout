import type { PhaseFile } from '#src/plan/common/types/PhaseFile.ts';
import type { CrossPhaseLintResult } from '#src/plan/internal/common/types/CrossPhaseLintResult.ts';
import type { PhaseProvenance } from '#src/plan/internal/common/types/PhaseProvenance.ts';
import type { PhaseSizeCounts } from '#src/plan/internal/common/types/PhaseSizeCounts.ts';
import { checkFileProvenance } from '#src/plan/lint/checkFileProvenance.ts';
import { checkPhaseCount } from '#src/plan/lint/checkPhaseCount.ts';
import { checkPhaseDeclarations } from '#src/plan/lint/checkPhaseDeclarations.ts';
import { checkPhaseHandoffs } from '#src/plan/lint/checkPhaseHandoffs.ts';
import { parsePhaseDeclarations } from '#src/plan/parsePhaseDeclarations.ts';

interface Params {
	cwd: string;
	overview?: PhaseFile;
	/** Ordered by phase number. */
	phases: PhaseFile[];
	provenance: PhaseProvenance;
	counts: Map<string, PhaseSizeCounts>;
}

/**
 * `clearedCreates` holds `<phase base>|<path>` keys for create paths an earlier
 * phase provably removes: the one case where this pass overrules a per-file finding.
 */
export const lintPlanCrossPhase = async ({ cwd, overview, phases, provenance, counts }: Params): Promise<CrossPhaseLintResult> => {
	if (overview === undefined && phases.length <= 1) {
		return { findings: [], clearedCreates: new Set<string>() };
	}

	const provenanceResult = await checkFileProvenance({ cwd, phases, provenance });
	const findings = [...provenanceResult.findings, ...checkPhaseHandoffs({ phases })];

	if (overview !== undefined) {
		const declarations = parsePhaseDeclarations({ plan: overview.plan });

		findings.push(
			...checkPhaseDeclarations({ declarations, phases, overviewBase: overview.base, counts }),
			...checkPhaseCount({ phaseCount: phases.length, overviewBase: overview.base }),
		);
	}

	return { findings, clearedCreates: provenanceResult.clearedCreates };
};
