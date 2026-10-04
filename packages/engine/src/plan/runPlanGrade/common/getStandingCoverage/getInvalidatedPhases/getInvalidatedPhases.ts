import { getAffectedPhases } from '#src/plan/runPlanGrade/common/getStandingCoverage/getInvalidatedPhases/getAffectedPhases.ts';

interface Params {
	edited: string[];
	connections?: Map<string, Set<string>>;
	recorded: Map<string, string[]>;
	phaseFiles: string[];
}

/** Recorded neighbours are merged in so a repair that cuts an edge does not also delete the reason to re-read the phase on the far side of it. */
const mergedConnections = ({ connections, recorded }: { connections: Map<string, Set<string>>; recorded: Map<string, string[]> }) => {
	const merged = new Map<string, Set<string>>([...connections].map(([base, neighbours]) => [base, new Set(neighbours)]));

	const link = ({ from, to }: { from: string; to: string }) => {
		const neighbours = merged.get(from) ?? new Set<string>();

		neighbours.add(to);
		merged.set(from, neighbours);
	};

	for (const [base, neighbours] of recorded) {
		for (const neighbour of neighbours) {
			link({ from: base, to: neighbour });
			link({ from: neighbour, to: base });
		}
	}

	return merged;
};

/**
 * Filtered to the plan files held now only after the walk, so a phase a resplit
 * deleted still carries reach ACROSS itself. An absent graph answers every plan
 * file: a reach the engine cannot place is a full review, never a guess.
 */
export const getInvalidatedPhases = ({ edited, connections, recorded, phaseFiles }: Params): string[] => {
	if (connections === undefined) {
		return [...phaseFiles].sort();
	}

	const affected = getAffectedPhases({ connections: mergedConnections({ connections, recorded }), edited });

	return affected.filter((base) => phaseFiles.includes(base));
};
