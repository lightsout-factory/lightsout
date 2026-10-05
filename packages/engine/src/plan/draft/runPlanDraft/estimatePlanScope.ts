import { PlanVariant } from '#src/contracts/plan/draft/PlanVariant.ts';
import type { PlanFacts } from '#src/contracts/plan/facts/PlanFacts.ts';

interface Params {
	facts: PlanFacts;
	/** `executor-file-limit` from config, already defaulted by the caller. */
	executorFileLimit: number;
}

/**
 * Facts carry no create-paths, so this is a lower bound on the real blast
 * radius; the four-fifths threshold leaves a buffer under the number the
 * implementing agent stops at. A plan estimated single that still authors many
 * new files is caught by the draft's single-to-phased escalation.
 */
export const estimatePlanScope = ({ facts, executorFileLimit }: Params): PlanVariant => {
	const phasedThreshold = Math.floor(executorFileLimit * 0.8);
	const paths = new Set<string>();

	for (const area of facts.areas) {
		for (const file of area.filesToModify) {
			paths.add(file.path);
		}

		for (const pattern of area.patternsToMirror) {
			paths.add(pattern.path);
		}
	}

	return paths.size > phasedThreshold ? PlanVariant.Overview : PlanVariant.Single;
};
