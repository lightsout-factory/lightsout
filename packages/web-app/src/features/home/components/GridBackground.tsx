import { GridPattern } from '#src/features/home/constants/GridPattern.ts';
import { cn } from '#src/utils/cn.ts';

const patternImages: Record<GridPattern, { backgroundImage: string; backgroundSize?: string }> = {
	[GridPattern.Lines]: {
		backgroundImage:
			'repeating-linear-gradient(0deg, var(--border) 0 1px, transparent 1px 64px), repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px 64px)',
	},
	[GridPattern.Squares]: {
		backgroundImage: 'linear-gradient(to right, var(--muted) 1px, transparent 1px), linear-gradient(to bottom, var(--muted) 1px, transparent 1px)',
		backgroundSize: '40px 40px',
	},
};

interface Props {
	pattern?: GridPattern;
	maskImage?: string;
	className?: string;
}

export const GridBackground = ({
	pattern = GridPattern.Lines,
	maskImage = 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
	className,
}: Props) => (
	<div
		aria-hidden="true"
		style={{
			...patternImages[pattern],
			maskImage,
			WebkitMaskImage: maskImage,
		}}
		className={cn('pointer-events-none absolute inset-0 opacity-60', className)}
	/>
);
