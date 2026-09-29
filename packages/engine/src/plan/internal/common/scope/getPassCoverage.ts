import type { GradeInputs } from '#src/contracts/plan/memory/GradeInputs.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import { gapCheckLenses } from '#src/plan/internal/common/constants/gapCheckLenses.ts';
import { getCoverageSeeds } from '#src/plan/internal/common/scope/getCoverageSeeds.ts';
import { getDesignHashes } from '#src/plan/internal/common/scope/getDesignHashes.ts';
import { getEditedPhases } from '#src/plan/internal/common/scope/getEditedPhases.ts';
import { getStandingCoverage } from '#src/plan/internal/common/scope/getStandingCoverage.ts';

interface Params {
	phaseFiles: string[];
	overviewText?: string;
	inputs: GradeInputs;
	coverage: GradeMemory['coverage'];
	/** Absent when it could not be built, which loses every plan file. */
	connections?: Map<string, Set<string>>;
	baseline?: GradeInputs;
}

/**
 * Giving `baseline` asks the BEFORE question: the plan files a changed decision
 * row or a moved input places as lost fall with it. Omitting it asks the AFTER
 * question — what the record this pass just wrote covers — where the baseline
 * would describe a reading this pass has since redone.
 */
export const getPassCoverage = ({ phaseFiles, overviewText, inputs, coverage, connections, baseline }: Params): ReturnType<typeof getStandingCoverage> => {
	const seeded = baseline === undefined ? { seeds: [] } : getCoverageSeeds({ inputs, previous: baseline, overviewText, phaseFiles });

	return getStandingCoverage({
		coverage,
		designHashes: getDesignHashes({ inputs }),
		phaseFiles,
		lenses: gapCheckLenses,
		connections,
		otherInputChanged: baseline !== undefined && getEditedPhases({ current: inputs, previous: baseline }).otherInputChanged,
		seeds: 'error' in seeded ? phaseFiles : seeded.seeds,
	});
};
