import type { RunStepView } from '@lightsout/engine';
import { formatDuration } from '@lightsout/shared';
import { BadgeVariant } from '#src/common/constants/BadgeVariant.ts';
import { runStatusFamilies } from '#src/common/constants/runStatusFamilies.ts';

// Spelled out rather than interpolated because Tailwind only emits classes it
// can read in the source. Every family is listed so a new variant cannot
// silently break the table.
const segmentColors: Record<BadgeVariant, string> = {
	[BadgeVariant.Neutral]: 'bg-muted',
	[BadgeVariant.Running]: 'bg-status-running',
	[BadgeVariant.Passed]: 'bg-status-passed',
	[BadgeVariant.Failed]: 'bg-status-failed',
	[BadgeVariant.Paused]: 'bg-status-paused',
	[BadgeVariant.Escalated]: 'bg-status-escalated',
	[BadgeVariant.Blocking]: 'bg-severity-blocking',
	[BadgeVariant.Advisory]: 'bg-severity-advisory',
	[BadgeVariant.Brand]: 'bg-[image:var(--brand-gradient)]',
};

interface Props {
	steps: RunStepView[];
	/** Sum of the step durations, which is what each segment is measured against. */
	activeMs: number;
}

/**
 * The segments need not fill the strip: normalising to 100% would claim time the
 * steps did not spend. A step with no duration gets a floor so it stays clickable.
 */
export const RunTimeline = ({ steps, activeMs }: Props) => {
	const minimumWidthPercent = 3;
	const denominator = activeMs > 0 ? activeMs : 1;

	return steps.length === 0 ? (
		<p className="text-muted-foreground text-sm">No steps recorded yet.</p>
	) : (
		<div className="flex h-8 w-full gap-0.5 overflow-hidden rounded-md">
			{steps.map((step) => (
				<a
					key={step.id}
					href={`#step-${step.id}`}
					title={`${step.id} · ${formatDuration({ ms: step.durationMs })}`}
					style={{ width: `${Math.max((100 * (step.durationMs ?? 0)) / denominator, minimumWidthPercent)}%` }}
					className={`${segmentColors[runStatusFamilies[step.status]]} min-w-1 rounded-sm opacity-80 transition-opacity hover:opacity-100`}
				>
					<span className="sr-only">{step.id}</span>
				</a>
			))}
		</div>
	);
};
