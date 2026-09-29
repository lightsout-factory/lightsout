import type { RunBurnDown, RunBurnDownBatch } from '@lightsout/engine';
import { PipelineKind, RunBurnDownBatchOutcome } from '@lightsout/engine/contracts';
import { MetadataTag } from '#src/appUI/badges/MetadataTag.tsx';
import { StatusBadge } from '#src/appUI/badges/StatusBadge.tsx';
import { Card } from '#src/appUI/panels/Card.tsx';
import { BadgeVariant } from '#src/common/constants/BadgeVariant.ts';
import { formatCount } from '#src/common/formatting/formatCount.ts';

const outcomeBadgeConfig: Record<RunBurnDownBatchOutcome, { label: string; variant: BadgeVariant }> = {
	[RunBurnDownBatchOutcome.Resolved]: { label: 'resolved', variant: BadgeVariant.Passed },
	[RunBurnDownBatchOutcome.Declined]: { label: 'declined', variant: BadgeVariant.Advisory },
	[RunBurnDownBatchOutcome.NotRun]: { label: 'not run', variant: BadgeVariant.Neutral },
};

const BatchRow = ({ batch }: { batch: RunBurnDownBatch }) => (
	<li className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 text-xs">
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
			<span className="font-medium font-mono">{batch.rule}</span>
			<MetadataTag>{batch.folder}</MetadataTag>
			<span className="text-muted-foreground">{formatCount({ count: batch.blocking, noun: 'site' })}</span>
			<StatusBadge status={batch.outcome} config={outcomeBadgeConfig} />
		</div>
		{batch.rationale.map((line) => (
			<p key={line} className="leading-5">
				{line}
			</p>
		))}
		{batch.advisoryOutcomes.map((advisory) => (
			<p key={`${advisory.rule}-${advisory.siteKey}`} className="text-muted-foreground">
				<span className="font-mono">{advisory.rule}</span> — {advisory.outcome}
				{advisory.reason === undefined ? '' : ` · ${advisory.reason}`}
			</p>
		))}
	</li>
);

const CoverageFiles = ({ files }: { files: NonNullable<RunBurnDown['files']> }) => (
	<div className="flex flex-col gap-2">
		<p className="text-sm">{formatCount({ count: files.filter((file) => file.afterPct > file.beforePct).length, noun: 'file' })} raised</p>
		<ul className="flex flex-col gap-0.5 text-xs">
			{files.map((file) => (
				<li key={file.path} className="flex items-baseline justify-between gap-3">
					<span className="min-w-0 truncate font-mono text-muted-foreground">{file.path}</span>
					<span>
						{file.beforePct}% → {file.afterPct}%
					</span>
				</li>
			))}
		</ul>
	</div>
);

const RefactorSites = ({ burnDown }: { burnDown: RunBurnDown }) => (
	<div className="flex flex-col gap-3">
		<p className="text-sm">
			{burnDown.before} → {burnDown.after} sites · {burnDown.batchesResolved ?? 0} resolved · {burnDown.batchesDeclined ?? 0} declined
		</p>
		{burnDown.overCap === undefined ? null : (
			<p className="text-muted-foreground text-sm">
				files over cap: {burnDown.overCap.before} → {burnDown.overCap.after}
			</p>
		)}
		<ul className="flex flex-col gap-2">
			{burnDown.batches.map((batch) => (
				<BatchRow key={batch.id} batch={batch} />
			))}
		</ul>
	</div>
);

interface Props {
	burnDown: RunBurnDown;
	pipeline: string;
}

/**
 * Draws the engine's own numbers rather than re-reading the manifest, so they
 * cannot drift. A coverage run shows files, not a threshold, because the
 * threshold lives in the repo's coverage command, not the manifest.
 */
export const BurnDownPanel = ({ burnDown, pipeline }: Props) => (
	<Card title="Burn-down">{pipeline === PipelineKind.Coverage ? <CoverageFiles files={burnDown.files ?? []} /> : <RefactorSites burnDown={burnDown} />}</Card>
);
