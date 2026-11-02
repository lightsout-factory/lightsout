import type { PlanDocument } from '@lightsout/engine';
import type { CoverageWorklist, RefactorWorklist } from '@lightsout/engine/contracts';

const CoverageMeasurement = ({ worklist }: { worklist: CoverageWorklist }) => (
	<div className="flex flex-col gap-4">
		<p className="text-muted-foreground text-xs">measured {worklist.at}</p>
		<ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
			{worklist.totals.map((total) => (
				<li key={total.scope}>
					<span className="font-mono">{total.scope}</span> — {total.statementsPct}%{' '}
					<span className={total.passed ? 'text-status-passed' : 'text-status-failed'}>{total.passed ? 'passing' : 'below threshold'}</span>
				</li>
			))}
		</ul>
		<ul className="flex flex-col gap-0.5 text-xs">
			{worklist.files.map((file) => (
				<li key={file.path} className="flex items-baseline justify-between gap-3">
					<span className="min-w-0 truncate font-mono text-muted-foreground">{file.path}</span>
					<span>{file.statementsPct}%</span>
				</li>
			))}
		</ul>
	</div>
);

const RefactorBatches = ({ worklist }: { worklist: RefactorWorklist }) => (
	<div className="flex flex-col gap-4">
		<p className="text-muted-foreground text-xs">
			frozen {worklist.at} · scope <span className="font-mono">{worklist.path}</span>
			{worklist.all ? ' · baselined findings included' : ''}
		</p>
		{worklist.batches.map((batch) => (
			<div key={batch.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2">
				<span className="font-medium font-mono text-sm">{batch.id}</span>
				<span className="text-muted-foreground text-xs">
					{batch.rule} · {batch.folder} · {batch.blocking.length} blocking · {batch.advisories.length} advisory
				</span>
				<ul className="flex flex-col gap-1 text-xs">
					{batch.blocking.map((finding) => (
						<li key={finding.siteKey}>
							<span className="font-mono text-muted-foreground-strong">{finding.siteKey}</span>
							<p className="leading-5">{finding.detail}</p>
						</li>
					))}
				</ul>
			</div>
		))}
	</div>
);

interface Props {
	plan: PlanDocument;
}

export const WorklistView = ({ plan }: Props) => (
	<div className="flex flex-col gap-4">
		{plan.worklist === undefined ? null : <RefactorBatches worklist={plan.worklist} />}
		{plan.coverageWorklist === undefined ? null : <CoverageMeasurement worklist={plan.coverageWorklist} />}
	</div>
);
