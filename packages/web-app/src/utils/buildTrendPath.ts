interface Params {
	/** At least two, or the single point would be a line that claims a direction nothing measured. */
	values: number[];
	/** The highest value in the set the line is drawn against, so several lines share one scale. */
	peak: number;
}

/**
 * SVG path data for a line through the values, in a 0–1 box the `viewBox`
 * scales: x runs across the points, and y runs down from the peak. A peak of 0
 * has nothing to divide by, so the line sits on the floor rather than claim a
 * shape.
 */
export const buildTrendPath = ({ values, peak }: Params): string =>
	values
		.map((value, index) => `${index === 0 ? 'M' : 'L'}${(index / (values.length - 1)).toFixed(4)},${(peak === 0 ? 1 : 1 - value / peak).toFixed(4)}`)
		.join(' ');
