import { RunStatus } from '@lightsout/engine/contracts';
import { formatCost, formatDuration } from '@lightsout/shared';
import { Link } from '@tanstack/react-router';
import { CopyButton } from '#src/components/ui/CopyButton.tsx';
import { StatusBadge } from '#src/components/ui/StatusBadge.tsx';
import { statusBadgeConfig } from '#src/constants/statusBadgeConfig.ts';
import { FailureNotice } from '#src/features/runs/components/FailureNotice.tsx';
import { PlanPathButton } from '#src/features/runs/components/PlanPathButton.tsx';
import { RunWhatNow } from '#src/features/runs/components/RunHeader/RunWhatNow.tsx';
import type { RunDetailView } from '#src/features/runs/types/RunDetailView.ts';
import { getRunCommand } from '#src/utils/getRunCommand.ts';

interface Props {
	view: RunDetailView;
	/** Opens a repo-relative plan path in the drawer. */
	onOpenPlan: (path: string) => void;
}

/**
 * Wall and active time are shown side by side: wall includes the idle gap between
 * a failure and its resume, and presenting either as the other misreports the run.
 * A `running` manifest with no live process is called out, because the manifest
 * alone is not the truth once a process has died.
 */
export const RunHeader = ({ view, onOpenPlan }: Props) => {
	const { listing } = view;
	const measures = [
		['wall', formatDuration({ ms: view.wallMs })],
		['active', formatDuration({ ms: view.activeMs })],
		['gates', formatDuration({ ms: view.gateMs })],
		['cost', view.usage === undefined ? '—' : formatCost({ usd: view.usage.costUsd })],
	];

	return (
		<header className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="font-semibold text-2xl">{listing.title}</h1>
				<StatusBadge status={listing.status} config={statusBadgeConfig} live={listing.live} />
			</div>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
				<span className="font-mono">{listing.shortId}</span>
				<CopyButton value={listing.shortId} label="Copy id" />
				<span>{view.harness}</span>
				<span>·</span>
				<span>{getRunCommand({ pipeline: listing.pipeline })}</span>
				{listing.packages.length === 0 ? null : (
					<>
						<span>·</span>
						<span>{listing.packages.join(' · ')}</span>
					</>
				)}
			</div>
			{listing.status === RunStatus.Running && !listing.live ? (
				<FailureNotice>The manifest still says running, but no process stands behind it — the run died without recording an ending.</FailureNotice>
			) : null}
			{view.parent === undefined ? null : (
				<p className="text-muted-foreground text-xs">
					phase <span className="font-mono">{view.parent.step}</span> of{' '}
					<Link to="/app/runs/$runId" params={{ runId: view.parent.runId }} className="text-primary underline underline-offset-2">
						{view.parent.title}
					</Link>
				</p>
			)}
			<div className="flex flex-col items-start gap-1">
				<PlanPathButton label="plan" path={listing.plan} onOpenPlan={onOpenPlan} />
				{view.overview === undefined ? null : <PlanPathButton label="overview" path={view.overview} onOpenPlan={onOpenPlan} />}
			</div>
			<dl className="flex flex-wrap gap-x-10 gap-y-3">
				{measures.map(([label, value]) => (
					<div key={label} className="flex flex-col gap-0.5">
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
						<dd className="font-medium text-sm">{value}</dd>
					</div>
				))}
			</dl>
			<RunWhatNow view={view} />
		</header>
	);
};
