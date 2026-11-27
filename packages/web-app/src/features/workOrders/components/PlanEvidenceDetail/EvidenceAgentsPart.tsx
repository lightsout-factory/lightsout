import { EvidenceProvenance, type PlanEvidence } from '@lightsout/engine/contracts';
import { EvidenceFigure } from '#src/features/workOrders/components/EvidenceFigure.tsx';
import { formatLocalTime } from '#src/utils/formatLocalTime.ts';

interface Props {
	agents: NonNullable<PlanEvidence['agents']>;
}

const listClass = 'flex flex-col gap-1 text-sm';

/** The agents behind the plan: how many ran, the most at once, the build's agents by step, each command run, and the calls agents made on their own. */
export const EvidenceAgentsPart = ({ agents }: Props) => (
	<div className="flex flex-col gap-5">
		<div className="flex flex-wrap gap-x-8 gap-y-2">
			<EvidenceFigure label="Agent processes" count={agents.processes} />
			<EvidenceFigure label="Peak running at once" count={agents.peakProcesses} />
		</div>
		{agents.byStep.length === 0 ? null : (
			<div className="flex flex-wrap gap-x-8 gap-y-2">
				{agents.byStep.map(({ step, invocations }) => (
					<EvidenceFigure key={step} label={step} count={invocations} />
				))}
			</div>
		)}
		{agents.timeline.length === 0 ? null : (
			<ol className={listClass} aria-label="Timeline">
				{agents.timeline.map((entry) => (
					<li key={`${entry.label}-${entry.startedAt}`} className="flex flex-wrap items-baseline gap-x-4">
						<span className="font-semibold">{entry.label}</span>
						<span className="text-muted-foreground text-xs">{formatLocalTime({ iso: entry.startedAt })}</span>
						<span>{entry.outcome ?? 'running'}</span>
						<EvidenceFigure label="Processes" count={entry.processes} />
					</li>
				))}
			</ol>
		)}
		<div className="flex flex-col gap-2">
			<EvidenceFigure label="Judgement calls" count={{ value: agents.judgementCalls.length, provenance: EvidenceProvenance.Reported }} />
			{agents.judgementCalls.length === 0 ? null : (
				<ul className={listClass}>
					{agents.judgementCalls.map((call) => (
						<li key={`${call.step}-${call.detail}`}>
							<span className="font-mono">{call.step}</span> — {call.detail}
						</li>
					))}
				</ul>
			)}
		</div>
	</div>
);
