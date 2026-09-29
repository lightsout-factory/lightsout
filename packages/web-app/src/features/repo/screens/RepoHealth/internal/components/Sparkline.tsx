import { cn } from '#src/common/utils/cn.ts';

interface Props {
	values: number[];
	className?: string;
}

/**
 * Coordinates are normalised to a 0–1 box that the `viewBox` scales, so nothing
 * recomputes on resize. Fewer than two points draws nothing rather than claim a
 * direction; an all-zero run has no peak to divide by, so it sits on the floor.
 */
export const Sparkline = ({ values, className }: Props) => {
	if (values.length < 2) {
		return null;
	}

	const peak = Math.max(...values);
	const data = values
		.map((value, index) => `${index === 0 ? 'M' : 'L'}${(index / (values.length - 1)).toFixed(4)},${(peak === 0 ? 1 : 1 - value / peak).toFixed(4)}`)
		.join(' ');

	return (
		<svg viewBox="0 0 1 1" preserveAspectRatio="none" role="img" aria-label="Recent trend" className={cn('h-6 w-full', className)}>
			<path d={data} fill="none" className="stroke-status-failed" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
		</svg>
	);
};
