import { WorkOrderStatus, type WorkOrderSummary } from '@lightsout/engine/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { SitePageFrame } from '#src/components/site/SitePageFrame.tsx';
import { MetadataTag } from '#src/components/ui/MetadataTag.tsx';
import { workOrderSummariesQueryOptions } from '#src/features/workOrders/queries/workOrderSummariesQueryOptions.ts';
import { formatLocalTime } from '#src/utils/formatLocalTime.ts';

const statusLabels: Record<WorkOrderStatus, string> = {
	[WorkOrderStatus.Planning]: 'Planning',
	[WorkOrderStatus.Building]: 'Building',
	[WorkOrderStatus.ReadyToShip]: 'Ready to ship',
	[WorkOrderStatus.Shipping]: 'Shipping',
	[WorkOrderStatus.Shipped]: 'Shipped',
	[WorkOrderStatus.Blocked]: 'Blocked',
};

/** The name is the row's link and the pull request sits beside it, never inside it, so neither link swallows the other. */
const WorkOrderRow = ({ summary }: { summary: WorkOrderSummary }) => (
	<li className="flex flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:gap-6">
		<Link
			to="/app/work-orders/$workOrder"
			params={{ workOrder: summary.name }}
			className="shrink-0 break-words font-bold font-mono text-drop-navy text-sm hover:text-primary md:w-72"
		>
			{summary.name}
		</Link>
		<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
			{summary.ticketRef === undefined ? null : <span className="font-mono">{summary.ticketRef}</span>}
			<MetadataTag>{statusLabels[summary.status]}</MetadataTag>
			<span>{summary.plansTotal === 0 ? 'No plans' : `${summary.plansDone} of ${summary.plansTotal} plans`}</span>
			{summary.prUrl === undefined ? null : (
				<a href={summary.prUrl} target="_blank" rel="noreferrer" className="text-brand-to underline underline-offset-4">
					Pull request
				</a>
			)}
		</div>
		<span className="shrink-0 text-muted-foreground text-xs">{formatLocalTime({ iso: summary.updatedAt })}</span>
	</li>
);

/** The local app's landing page: the work orders this repository holds, newest first, as the engine orders them. */
export const WorkOrdersScreen = () => {
	const { data: summaries } = useSuspenseQuery(workOrderSummariesQueryOptions());

	return (
		<SitePageFrame>
			<h1 className="font-extrabold text-4xl text-drop-navy tracking-tight md:text-5xl">Work orders</h1>
			{summaries.length === 0 ? (
				<p className="text-muted-foreground">No work orders yet.</p>
			) : (
				<ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
					{summaries.map((summary) => (
						<WorkOrderRow key={summary.name} summary={summary} />
					))}
				</ul>
			)}
		</SitePageFrame>
	);
};
