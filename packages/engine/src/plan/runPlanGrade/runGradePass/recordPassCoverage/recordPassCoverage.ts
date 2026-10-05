import type { GapCheckLens } from '#src/contracts/plan/grade/GapCheckLens.ts';
import type { GradeDocsCoverage } from '#src/contracts/plan/memory/GradeDocsCoverage.ts';
import type { GradeInputs } from '#src/contracts/plan/memory/GradeInputs.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import type { GradeReadCoverage } from '#src/contracts/plan/memory/GradeReadCoverage.ts';
import { gapCheckLenses } from '#src/plan/runPlanGrade/common/constants/gapCheckLenses.ts';
import { getDesignHashes } from '#src/plan/runPlanGrade/common/getDesignHashes.ts';
import { getPassCoverage } from '#src/plan/runPlanGrade/runGradePass/common/getPassCoverage.ts';
import { recordReadCoverage } from '#src/plan/runPlanGrade/runGradePass/recordPassCoverage/recordReadCoverage.ts';

interface Params {
	planFiles: string[];
	overviewText?: string;
	inputs: GradeInputs;
	/** The reader entries that still stood when this pass began. */
	standing: GradeReadCoverage[];
	docs?: GradeDocsCoverage;
	/** Every (plan file, lens) pair a reader RETURNED for on this pass. */
	read: Array<{ phase: string; lens: GapCheckLens }>;
	/** Read by nobody, and covered at their current text. */
	light: string[];
	connections?: Map<string, Set<string>>;
	/** Whether the documentation checker ran AND returned on this pass. */
	documentationChecked: boolean;
	/** True when a human narrowed this pass with `--phase`: nothing is recorded. */
	narrowed: boolean;
	at: string;
}

/**
 * The entries are written BEFORE the coverage is read back, because the verdict
 * has to see what this pass itself just read. Reading back with no baseline is
 * deliberate: a baseline's seeds describe a reading this pass has since redone.
 */
export const recordPassCoverage = ({
	planFiles,
	overviewText,
	inputs,
	standing,
	docs,
	read,
	light,
	connections,
	documentationChecked,
	narrowed,
	at,
}: Params): { coverage: GradeMemory['coverage']; standing: ReturnType<typeof getPassCoverage> } => {
	const coverage = recordReadCoverage({
		standing,
		docs,
		read,
		light: { phases: light, lenses: gapCheckLenses },
		designHashes: getDesignHashes({ inputs }),
		connections,
		documentationChecked,
		narrowed,
		at,
	});

	return { coverage, standing: getPassCoverage({ phaseFiles: planFiles, overviewText, inputs, coverage, connections }) };
};
