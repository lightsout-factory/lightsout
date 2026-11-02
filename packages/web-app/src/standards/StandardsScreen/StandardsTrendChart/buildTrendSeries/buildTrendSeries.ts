import type { StandardsTrendPoint } from '@lightsout/engine';
import { buildTrendPath } from '#src/common/buildTrendPath.ts';
import type { TrendSeries } from '#src/standards/StandardsScreen/StandardsTrendChart/buildTrendSeries/TrendSeries.ts';

interface Params {
	points: StandardsTrendPoint[];
}

/** Fewer than two points returns nothing: a single snapshot drawn as a line would claim a direction nothing measured. */
export const buildTrendSeries = ({ points }: Params): TrendSeries | undefined => {
	if (points.length < 2) {
		return undefined;
	}

	const peak = Math.max(...points.map((point) => point.total));

	return {
		blocking: buildTrendPath({ values: points.map((point) => point.blocking), peak }),
		total: buildTrendPath({ values: points.map((point) => point.total), peak }),
		from: points[0].at,
		to: points[points.length - 1].at,
		peak,
	};
};
