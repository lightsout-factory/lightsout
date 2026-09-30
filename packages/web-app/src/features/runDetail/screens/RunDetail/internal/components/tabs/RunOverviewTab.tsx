import { PipelineKind } from '@lightsout/engine/contracts';
import { formatCost, formatDuration, formatShortRunId } from '@lightsout/shared';
import { StatusBadge } from '#src/appUI/badges/StatusBadge.tsx';
import { Card } from '#src/appUI/panels/Card.tsx';
import { statusBadgeConfig } from '#src/common/constants/statusBadgeConfig.ts';
import { formatCount } from '#src/common/formatting/formatCount.ts';
import { summarizeStepReport } from '#src/features/runDetail/common/utils/summarizeStepReport.ts';
import { StepReportKind } from '#src/features/runDetail/internal/common/constants/StepReportKind.ts';
import type { RunDetailStep } from '#src/features/runDetail/internal/common/types/RunDetailStep.ts';
import type { RunDetailView } from '#src/features/runDetail/internal/common/types/RunDetailView.ts';
import { BurnDownPanel } from '#src/features/runDetail/screens/RunDetail/internal/components/BurnDownPanel.tsx';
import { PhaseList } from '#src/features/runDetail/screens/RunDetail/internal/components/PhaseList.tsx';
import { RunTimeline } from '#src/features/runDetail/screens/RunDetail/internal/components/RunTimeline.tsx';

const describeReport = ({ report }: { report?: object }) => {
	const summary = summarizeStepReport({ report });
	let line = '';

	if (summary?.kind === StepReportKind.Batch) {
		line = `${summary.outcome} · ${formatCount({ count: summary.remaining, noun: 'site' })} still standing`;
	} else if (summary?.kind === StepReportKind.Phase) {
		line = `implemented by run ${formatShortRunId({ runId: summary.runId })}`;
	} else if (summary?.kind === StepReportKind.Writers) {
		line = `${formatCount({ count: summary.count, noun: 'writer batch', plural: 'writer batches' })} · ${formatCount({ count: summary.fileCount, noun: 'file' })}`;
	} else if (summary?.kind === StepReportKind.Cleanup) {
		line = `${formatCount({ count: summary.rounds, noun: 'round' })} · ${summary.endReason ?? 'in progress'} · ${formatCount({ count: summary.remaining, noun: 'finding' })} still standing`;
	} else if (summary?.kind === StepReportKind.Work) {
		line = summary.summary;
	}

	return line;
};

const StepRow = ({ step, onOpen }: { step: RunDetailStep; onOpen: () => void }) => (
	<button
		type="button"
		onClick={onOpen}
		className="flex w-full flex-col gap-1 rounded-md border border-border px-3 py-2 text-left transition-colors hover:bg-accent"
	>
		<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
			<span className="font-medium font-mono text-sm">{step.id}</span>
			<StatusBadge status={step.status} config={statusBadgeConfig} />
			<span className="text-muted-foreground text-xs">
				{formatDuration({ ms: step.durationMs })} · {formatCount({ count: step.attempts, noun: 'attempt' })} ·{' '}
				{formatCount({ count: step.changedFiles.length, noun: 'file' })} · {formatCost({ usd: step.costUsd })}
			</span>
		</span>
		<span className="text-muted-foreground text-xs">{describeReport({ report: step.report })}</span>
	</button>
);

interface Props {
	view: RunDetailView;
	onOpenStep: (stepId: string) => void;
}

export const RunOverviewTab = ({ view, onOpenStep }: Props) => (
	<div className="flex flex-col gap-6">
		<Card title="Timeline">
			<RunTimeline steps={view.steps} activeMs={view.activeMs} />
		</Card>
		{view.burnDown === undefined ? null : <BurnDownPanel burnDown={view.burnDown} pipeline={view.listing.pipeline} />}
		{view.listing.pipeline === PipelineKind.Phases ? <PhaseList steps={view.steps} /> : null}
		<div className="flex flex-col gap-2">
			{view.steps.map((step) => (
				<StepRow key={step.id} step={step} onOpen={() => onOpenStep(step.id)} />
			))}
		</div>
	</div>
);
