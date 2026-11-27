import type { PlanWorkspaceView } from '@lightsout/engine/contracts';
import { formatDuration } from '@lightsout/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Markdown } from '#src/components/markdown/Markdown/Markdown.tsx';
import { SitePageFrame } from '#src/components/site/SitePageFrame.tsx';
import { SiteSection } from '#src/components/site/SiteSection.tsx';
import { MetadataTag } from '#src/components/ui/MetadataTag.tsx';
import { Tabs } from '#src/components/ui/Tabs.tsx';
import { DecisionTable } from '#src/features/workOrders/components/DecisionTable.tsx';
import { DedupDetail } from '#src/features/workOrders/components/DedupDetail.tsx';
import { FactsDetail } from '#src/features/workOrders/components/FactsDetail.tsx';
import { GradeDetail } from '#src/features/workOrders/components/GradeDetail.tsx';
import { GradeHistory } from '#src/features/workOrders/components/GradeHistory.tsx';
import { planWorkspaceQueryOptions } from '#src/features/workOrders/queries/planWorkspaceQueryOptions.ts';
import { formatLocalTime } from '#src/utils/formatLocalTime.ts';

const noteClass = 'text-muted-foreground text-sm';

const cellClass = 'px-4 py-2.5 align-top';

const headerClass = 'whitespace-nowrap px-4 py-2.5 font-semibold text-muted-foreground-strong text-xs uppercase tracking-wide';

/** The plan top to bottom: the drafted plan or overview first, then each phase as its own section, archived ones included. */
const PlanTab = ({ workspace }: { workspace: PlanWorkspaceView }) => (
	<div className="flex flex-col gap-10">
		{workspace.planText === undefined ? <p className={noteClass}>No plan drafted yet.</p> : <Markdown text={workspace.planText} variant="article" />}
		{workspace.phases.map((phase) => (
			<SiteSection key={phase.name} title={phase.name}>
				{phase.implemented ? (
					<span>
						<MetadataTag>Implemented</MetadataTag>
					</span>
				) : null}
				<Markdown text={phase.text} variant="article" />
			</SiteSection>
		))}
	</div>
);

const BrainstormTab = ({ workspace }: { workspace: PlanWorkspaceView }) => (
	<div className="flex flex-col gap-8">
		{workspace.notesText === undefined ? <p className={noteClass}>No brainstorm notes.</p> : <Markdown text={workspace.notesText} variant="article" />}
		{workspace.brainstormDecisions === undefined ? null : <DecisionTable rows={workspace.brainstormDecisions.decisions} />}
	</div>
);

const DecisionsTab = ({ workspace }: { workspace: PlanWorkspaceView }) =>
	workspace.decisions === undefined ? <p className={noteClass}>No decisions recorded yet.</p> : <DecisionTable rows={workspace.decisions.decisions} />;

/** Each step's status as recorded, its attempts and its duration; a running step whose process is gone already reads as failed. */
const PlanningTable = ({ steps }: { steps: PlanWorkspaceView['planningSteps'] }) => (
	<div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
		<table className="w-full border-collapse text-left text-sm">
			<thead className="bg-muted/50">
				<tr>
					<th className={headerClass}>Step</th>
					<th className={headerClass}>Status</th>
					<th className={headerClass}>Attempts</th>
					<th className={headerClass}>Duration</th>
				</tr>
			</thead>
			<tbody>
				{steps.map((step) => (
					<tr key={step.id} className="border-border border-t">
						<td className={`${cellClass} font-mono`}>{step.id}</td>
						<td className={cellClass}>{step.status ?? 'not run'}</td>
						<td className={cellClass}>{step.attempts}</td>
						<td className={cellClass}>{formatDuration({ ms: step.durationMs })}</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);

/** Runs are listed, never linked: the terminal is where a run is read in depth. */
const RunsList = ({ runs }: { runs: PlanWorkspaceView['runs'] }) =>
	runs.length === 0 ? (
		<p className={noteClass}>No runs yet.</p>
	) : (
		<ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
			{runs.map((run) => (
				<li key={run.runId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
					<span className="font-mono">{run.shortId}</span>
					<span className="font-semibold">{run.title}</span>
					<span>{run.status}</span>
					{run.live ? <MetadataTag>Live</MetadataTag> : null}
					<span className="text-muted-foreground text-xs">{formatLocalTime({ iso: run.updatedAt })}</span>
				</li>
			))}
		</ul>
	);

/** How the plan got here, in the order it happened: planned, graded, checked for duplicates, then built. */
const StatusTab = ({ workspace }: { workspace: PlanWorkspaceView }) => (
	<div className="flex flex-col gap-10">
		<PlanningTable steps={workspace.planningSteps} />
		<SiteSection title="Grade">
			<GradeDetail grade={workspace.grade} />
		</SiteSection>
		<SiteSection title="Grading history">
			<GradeHistory passes={workspace.gradePasses} findings={workspace.gradeFindings} />
		</SiteSection>
		<SiteSection title="Duplicate check">
			<DedupDetail dedup={workspace.dedup} />
		</SiteSection>
		<SiteSection title="Runs">
			<RunsList runs={workspace.runs} />
		</SiteSection>
	</div>
);

interface Props {
	/** The work order's folder name. */
	workOrder: string;
	/** The plan's id within it. */
	plan: string;
}

/** One plan, read-only: its text, how it was talked through, what was decided, what was confirmed in the code, and how planning and its runs went. */
export const PlanScreen = ({ workOrder, plan }: Props) => {
	const { data: workspace } = useSuspenseQuery(planWorkspaceQueryOptions({ workOrder, plan }));

	return (
		<SitePageFrame
			crumbs={[
				{ label: 'Work orders', link: { to: '/app' } },
				{ label: workOrder, link: { to: '/app/work-orders/$workOrder', params: { workOrder } } },
				{ label: plan },
			]}
		>
			<h1 className="break-words font-extrabold font-mono text-3xl text-drop-navy tracking-tight md:text-4xl">{plan}</h1>
			{workspace.problems.length === 0 ? null : (
				<ul className="flex list-disc flex-col gap-1 rounded-2xl border border-border bg-muted/40 py-4 pr-5 pl-10 text-sm">
					{workspace.problems.map((problem) => (
						<li key={problem}>{problem}</li>
					))}
				</ul>
			)}
			<Tabs
				items={[
					{ value: 'plan', label: 'Plan', content: <PlanTab workspace={workspace} /> },
					{ value: 'brainstorm', label: 'Brainstorm', content: <BrainstormTab workspace={workspace} /> },
					{ value: 'decisions', label: 'Decisions', content: <DecisionsTab workspace={workspace} /> },
					{ value: 'facts', label: 'Facts', content: <FactsDetail facts={workspace.facts} /> },
					{ value: 'status', label: 'Status', content: <StatusTab workspace={workspace} /> },
				]}
			/>
		</SitePageFrame>
	);
};
