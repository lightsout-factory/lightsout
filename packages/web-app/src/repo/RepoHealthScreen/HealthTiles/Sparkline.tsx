import { buildTrendPath } from '#src/common/buildTrendPath.ts';
import { cn } from '#src/common/cn.ts';

interface Props {
	values: number[];
	className?: string;
}

/** Fewer than two points draws nothing rather than claim a direction. */
export const Sparkline = ({ values, className }: Props) => {
	if (values.length < 2) {
		return null;
	}

	const data = buildTrendPath({ values, peak: Math.max(...values) });

	return (
		<svg viewBox="0 0 1 1" preserveAspectRatio="none" role="img" aria-label="Recent trend" className={cn('h-6 w-full', className)}>
			<path d={data} fill="none" className="stroke-status-failed" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
		</svg>
	);
};
