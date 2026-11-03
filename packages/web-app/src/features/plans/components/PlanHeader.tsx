import type { PlanWorkspaceView } from '@lightsout/engine';
import { Link } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import { IconList } from '#src/components/ui/IconList.tsx';
import { MetadataTag } from '#src/components/ui/MetadataTag.tsx';
import { StatusBadge } from '#src/components/ui/StatusBadge.tsx';
import { planGradeBadgeConfig } from '#src/features/plans/constants/planGradeBadgeConfig.ts';
import { planStageBadgeConfig } from '#src/features/plans/constants/planStageBadgeConfig.ts';
import { formatCount } from '#src/utils/formatCount.ts';

/** A corrupt workspace is shown rather than quietly rendered as empty. */
const PlanProblems = ({ problems }: { problems: string[] }) => (
	<IconList
		items={problems}
		Icon={TriangleAlert}
		className="flex flex-col gap-1 rounded-lg border border-status-failed-border bg-status-failed-light px-4 py-3 text-sm text-status-failed"
		itemClassName="items-center"
		iconClassName="size-4 text-status-failed"
	/>
);

interface Props {
	view: PlanWorkspaceView;
}

export const PlanHeader = ({ view }: Props) => (
	<header className="flex flex-col gap-3">
		{view.problems.length === 0 ? null : <PlanProblems problems={view.problems} />}
		<div className="flex flex-wrap items-center gap-2">
			<h1 className="font-semibold text-2xl">{view.listing.name}</h1>
			<StatusBadge status={view.listing.stage} config={planStageBadgeConfig} />
			{view.listing.grade === undefined ? null : <StatusBadge status={view.listing.grade} config={planGradeBadgeConfig} />}
		</div>
		<MetadataTag className="max-w-full truncate" title={view.rootPath}>
			{view.rootPath}
		</MetadataTag>
		{view.runs.length === 0 ? (
			<p className="text-muted-foreground text-sm">No run has been started from this plan yet.</p>
		) : (
			<div className="flex flex-wrap items-center gap-2 text-sm">
				<span className="text-muted-foreground">{formatCount({ count: view.runs.length, noun: 'run' })}:</span>
				{view.runs.map((run) => (
					<Link
						key={run.runId}
						to="/app/runs/$runId"
						params={{ runId: run.runId }}
						className="flex min-w-0 items-center gap-2 hover:underline hover:underline-offset-2"
					>
						<MetadataTag>{run.shortId}</MetadataTag>
						<span className="min-w-0 truncate">{run.title}</span>
					</Link>
				))}
			</div>
		)}
	</header>
);
