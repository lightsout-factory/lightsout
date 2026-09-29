import type { GapObservation } from '#src/contracts/plan/grade/GapObservation.ts';

interface Params {
	/** Every observation the finding holds; empty on a single-observation finding. */
	observations: GapObservation[];
	/** The finding's own plan file — the one location when it holds no observations. */
	phase: string;
}

/**
 * Never sorted: a finding's own `phase` is its representative location, and
 * sorting would move it away from the front.
 */
export const findingLocations = ({ observations, phase }: Params): string[] =>
	observations.length === 0 ? [phase] : [...new Set(observations.map((observation) => observation.phase))];
