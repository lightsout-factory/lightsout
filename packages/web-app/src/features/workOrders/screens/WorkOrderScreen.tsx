import { PlanProgress, RunStatus, ShipStatus, WorkOrderMode, type WorkOrderView } from '@lightsout/engine/contracts';
import { formatDuration } from '@lightsout/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { SitePageFrame } from '#src/components/site/SitePageFrame.tsx';
import { SiteSection } from '#src/components/site/SiteSection.tsx';
import { MetadataTag } from '#src/components/ui/MetadataTag.tsx';
import { workOrderViewQueryOptions } from '#src/features/workOrders/queries/workOrderViewQueryOptions.ts';
import { formatLocalTime } from '#src/utils/formatLocalTime.ts';

const progressLabels: Record<PlanProgress, string> = {
	[PlanProgress.Planning]: 'Planning',
	[PlanProgress.Ready]: 'Ready',
	[PlanProgress.Implementing]: 'Implementing',
	[PlanProgress.Implemented]: 'Implemented',
	[PlanProgress.Failed]: 'Failed',
};

const modeLabels: Record<WorkOrderMode, string> = {
	[WorkOrderMode.SinglePlan]: 'Single plan',
	[WorkOrderMode.MultiplePlan]: 'Multiple plans',
};

const runStatusLabels: Record<RunStatus, string> = {
	[RunStatus.Pending]: 'Pending',
	[RunStatus.Running]: 'Running',
	[RunStatus.Passed]: 'Passed',
	[RunStatus.Failed]: 'Failed',
	[RunStatus.PausedRateLimit]: 'Paused rate limit',
	[RunStatus.PausedBudget]: 'Paused budget',
	[RunStatus.Escalated]: 'Escalated',
};

const rowClass = 'flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm';

const listClass = 'flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm';

/** The ticket is plain text: nothing on disk holds its link, and the app never asks the tracker. */
const WorkOrderHeader = ({ view }: { view: WorkOrderView }) => (
	<header className="flex flex-col gap-4">
		<h1 className="break-words font-extrabold font-mono text-3xl text-drop-navy tracking-tight md:text-4xl">{view.summary.name}</h1>
		<p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
			{view.summary.ticketRef === undefined ? null : <span className="font-mono">{view.summary.ticketRef}</span>}
			<span className="font-mono">{view.summary.branch}</span>
			<MetadataTag>{modeLabels[view.mode]}</MetadataTag>
			{view.summary.prUrl === undefined ? null : (
				<a href={view.summary.prUrl} target="_blank" rel="noreferrer" className="text-brand-to underline underline-offset-4">
					Pull request
				</a>
			)}
		</p>
	</header>
);

/** A work order holding no plan 001 in single-plan mode is built from the ticket body, with how far that build got. */
const TicketBodyNote = ({ build }: { build: WorkOrderView['ticketBodyBuild'] }) => {
	const progress = build === undefined ? '' : ` · ${progressLabels[build.progress]} since ${formatLocalTime({ iso: build.startedAt })}`;

	return <p className="text-muted-foreground text-sm">Built from the ticket body{progress}</p>;
};

const PlansSection = ({ view }: { view: WorkOrderView }) => (
	<SiteSection title="Plans">
		{view.builtFromTicketBody ? <TicketBodyNote build={view.ticketBodyBuild} /> : null}
		{view.plans.length === 0 && !view.builtFromTicketBody ? <p className="text-muted-foreground text-sm">No plans yet.</p> : null}
		{view.plans.length === 0 ? null : (
			<ul className={listClass}>
				{view.plans.map((plan) => (
					<li key={plan.id} className={rowClass}>
						<Link
							to="/app/work-orders/$workOrder/plans/$plan"
							params={{ workOrder: view.summary.name, plan: plan.id }}
							className="font-bold text-drop-navy hover:text-primary"
						>
							{plan.title}
						</Link>
						<span className="font-mono text-muted-foreground text-xs">{plan.id}</span>
						<MetadataTag>{progressLabels[plan.progress]}</MetadataTag>
						{plan.exclusion === undefined ? null : <span className="text-muted-foreground">Excluded — {plan.exclusion.reason}</span>}
					</li>
				))}
			</ul>
		)}
	</SiteSection>
);

const ShipResultNote = ({ shipResult }: { shipResult: NonNullable<WorkOrderView['shipResult']> }) => (
	<div className="flex flex-col gap-2 text-sm">
		<p>
			{shipResult.status === ShipStatus.Shipped ? 'Shipped' : 'Blocked'}
			{shipResult.reason === undefined ? null : <span className="font-mono"> · {shipResult.reason}</span>}
		</p>
		{shipResult.detail === undefined ? null : <p className="text-muted-foreground">{shipResult.detail}</p>}
		{shipResult.failingChecks.length === 0 ? null : (
			<ul className="list-disc pl-6 font-mono text-xs">
				{shipResult.failingChecks.map((check) => (
					<li key={check}>{check}</li>
				))}
			</ul>
		)}
	</div>
);

const ShipSection = ({ view }: { view: WorkOrderView }) => (
	<SiteSection title="Ship">
		{view.shipResult === undefined ? null : <ShipResultNote shipResult={view.shipResult} />}
		{view.shipSteps.length === 0 ? null : (
			<ul className={listClass}>
				{view.shipSteps.map((step) => (
					<li key={step.id} className={rowClass}>
						<span className="font-mono md:w-40">{step.id}</span>
						<span className="md:w-32">{step.status === undefined ? 'not run' : runStatusLabels[step.status]}</span>
						<span className="text-muted-foreground">{formatDuration({ ms: step.durationMs })}</span>
					</li>
				))}
			</ul>
		)}
		{view.shipResult === undefined && view.shipSteps.length === 0 ? <p className="text-muted-foreground text-sm">Not shipped yet.</p> : null}
	</SiteSection>
);

const HistorySection = ({ view }: { view: WorkOrderView }) => (
	<SiteSection title="History">
		{view.history.length === 0 ? (
			<p className="text-muted-foreground text-sm">Nothing recorded yet.</p>
		) : (
			<ol className={listClass}>
				{view.history.map((event) => (
					<li key={`${event.at}-${event.detail}`} className={rowClass}>
						<span className="shrink-0 text-muted-foreground text-xs">{formatLocalTime({ iso: event.at })}</span>
						<span>{event.detail}</span>
					</li>
				))}
			</ol>
		)}
	</SiteSection>
);

interface Props {
	/** The folder's name under the work-orders directory. */
	name: string;
}

/** One work order: its plans, how its ship went, and everything its record holds in history. */
export const WorkOrderScreen = ({ name }: Props) => {
	const { data: view } = useSuspenseQuery(workOrderViewQueryOptions({ name }));

	return (
		<SitePageFrame crumbs={[{ label: 'Work orders', link: { to: '/app' } }, { label: name }]}>
			<WorkOrderHeader view={view} />
			<PlansSection view={view} />
			<ShipSection view={view} />
			<HistorySection view={view} />
		</SitePageFrame>
	);
};
