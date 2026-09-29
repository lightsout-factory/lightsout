import type { GapObservation } from '#src/contracts/plan/grade/GapObservation.ts';
import { collapseText } from '#src/plan/internal/common/memory/collapseText.ts';

interface Params {
	observations: GapObservation[];
}

export const dedupeObservations = ({ observations }: Params): GapObservation[] => {
	const seen = new Set<string>();

	return observations.filter((observation) => {
		const key = JSON.stringify([observation.phase, observation.lens, observation.area, collapseText({ text: observation.gap })]);
		const repeat = seen.has(key);

		seen.add(key);

		return !repeat;
	});
};
