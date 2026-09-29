import type { StandardsTrendPoint } from '@lightsout/engine';
import type { TrendSeries } from '#src/features/standards/internal/common/types/TrendSeries.ts';

interface Params {
	points: StandardsTrendPoint[];
}

/** An all-zero series has no peak, so its points sit on the floor rather than dividing by zero. */
const buildPath = ({ counts, peak }: { counts: number[]; peak: number }) =>
	counts
		.map((count, index) => `${index === 0 ? 'M' : 'L'}${(index / (counts.length - 1)).toFixed(4)},${(peak === 0 ? 1 : 1 - count / peak).toFixed(4)}`)
		.join(' ');

/** Fewer than two points returns nothing: a single snapshot drawn as a line would claim a direction nothing measured. */
export const buildTrendSeries = ({ points }: Params): TrendSeries | undefined => {
	if (points.length < 2) {
		return undefined;
	}

	const peak = Math.max(...points.map((point) => point.total));

	return {
		blocking: buildPath({ counts: points.map((point) => point.blocking), peak }),
		total: buildPath({ counts: points.map((point) => point.total), peak }),
		from: points[0].at,
		to: points[points.length - 1].at,
		peak,
	};
};
