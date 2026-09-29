import type { GradeInputs } from '#src/contracts/plan/memory/GradeInputs.ts';
import { getDecisionReach } from '#src/plan/internal/common/scope/getDecisionReach.ts';
import { getEditedPhases } from '#src/plan/internal/common/scope/getEditedPhases.ts';

interface Params {
	inputs: GradeInputs;
	/** The memory's `lastPass.inputs`; absent when no pass is on record. */
	previous?: GradeInputs;
	overviewText?: string;
	phaseFiles: string[];
}

/**
 * A pass with no baseline has read nothing, so every plan file is a seed rather
 * than none.
 *
 * The scope decision and the re-verification must share this one answer: two
 * reach rules that can disagree is the defect one reach rule exists to avoid.
 */
export const getCoverageSeeds = ({ inputs, previous, overviewText, phaseFiles }: Params): { seeds: string[] } | { error: string } => {
	if (previous === undefined) {
		return { seeds: phaseFiles };
	}

	const { edited, overviewFileChanged } = getEditedPhases({ current: inputs, previous });

	if (overviewText === undefined) {
		return { seeds: edited };
	}

	const reach = getDecisionReach({ current: inputs.decisionLog, previous: previous.decisionLog, overviewFileChanged, edited, phaseFiles });

	return 'error' in reach ? { error: reach.error } : { seeds: [...edited, ...reach.phases] };
};
