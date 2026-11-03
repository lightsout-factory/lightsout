export interface TrendSeries {
	/** SVG path data for the blocking line and the total line, in a 0–1 unit box. */
	blocking: string;
	total: string;
	/** Axis labels: the first and last timestamps, and the highest count plotted. */
	from: string;
	to: string;
	peak: number;
}
