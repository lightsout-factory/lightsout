import { EvidenceSectionState, type PlanEvidence } from '@lightsout/engine/contracts';
import { formatDuration } from '@lightsout/shared';
import type { ReactNode } from 'react';
import { SiteSection } from '#src/components/site/SiteSection.tsx';
import { MetadataTag } from '#src/components/ui/MetadataTag.tsx';
import { EvidenceFigure } from '#src/features/workOrders/components/EvidenceFigure.tsx';
import { EvidenceHeadlineRow } from '#src/features/workOrders/components/EvidenceHeadlineRow.tsx';
import { EvidenceAgentsPart } from '#src/features/workOrders/components/PlanEvidenceDetail/EvidenceAgentsPart.tsx';
import { EvidenceCleanupPart } from '#src/features/workOrders/components/PlanEvidenceDetail/EvidenceCleanupPart.tsx';
import { EvidencePlanPart } from '#src/features/workOrders/components/PlanEvidenceDetail/EvidencePlanPart.tsx';
import { formatLocalTime } from '#src/utils/formatLocalTime.ts';

const figureRowClass = 'flex flex-wrap gap-x-8 gap-y-2';

/** One section of the summary, marked while the step behind it is still going. */
const EvidenceSection = ({ title, state, children }: { title: string; state: EvidenceSectionState; children: ReactNode }) => (
	<SiteSection title={title}>
		{state === EvidenceSectionState.InProgress ? (
			<span>
				<MetadataTag>In progress</MetadataTag>
			</span>
		) : null}
		{children}
	</SiteSection>
);

/** A review figure that was never recorded is not drawn, so it never reads as a review that found nothing. */
const TestsPart = ({ tests }: { tests: NonNullable<PlanEvidence['tests']> }) => (
	<div className="flex flex-col gap-3">
		{tests.reviewedFiles?.value === 0 ? <p className="text-sm">No test changes to review</p> : null}
		<div className={figureRowClass}>
			{tests.acceptanceTests === undefined ? null : <EvidenceFigure label="Acceptance tests written" count={tests.acceptanceTests} />}
			{tests.reviewedFiles === undefined || tests.reviewedFiles.value === 0 ? null : <EvidenceFigure label="Test files reviewed" count={tests.reviewedFiles} />}
			{tests.rejections === undefined || tests.reviewedFiles?.value === 0 ? null : <EvidenceFigure label="Review rejections" count={tests.rejections} />}
			{tests.testCount === undefined ? null : <EvidenceFigure label="Tests before" count={tests.testCount.before} />}
			{tests.testCount === undefined ? null : <EvidenceFigure label="Tests after" count={tests.testCount.after} />}
		</div>
	</div>
);

/** The agent's own pre-checks are their own line, never counted with the gate runs. */
const ChecksPart = ({ checks }: { checks: NonNullable<PlanEvidence['checks']> }) => (
	<div className="flex flex-col gap-3">
		<div className={figureRowClass}>
			<EvidenceFigure label="Gate runs" count={checks.gateRuns} />
			<EvidenceFigure label="Failed" count={checks.failed} />
			<EvidenceFigure label="Fixed after failing" count={checks.fixed} />
		</div>
		<EvidenceFigure label="Agent pre-checks" count={checks.selfChecks} />
		{checks.repairs.length === 0 ? null : (
			<div className={figureRowClass}>
				{checks.repairs.map(({ gateFamily, attempts }) => (
					<EvidenceFigure key={gateFamily} label={`Repairs · ${gateFamily}`} count={attempts} />
				))}
			</div>
		)}
	</div>
);

const ShipPart = ({ ship }: { ship: NonNullable<PlanEvidence['ship']> }) => (
	<div className="flex flex-col gap-3 text-sm">
		{ship.result === undefined ? (
			<p className="text-muted-foreground">No ship result recorded yet.</p>
		) : (
			<div className="flex flex-col gap-1">
				<p>
					Ship result: <MetadataTag>{ship.result.status}</MetadataTag>
				</p>
				{ship.result.prUrl === undefined ? null : (
					<a className="underline" href={ship.result.prUrl}>
						{ship.result.prUrl}
					</a>
				)}
				{ship.result.mergedAt === undefined ? null : <p>Merged {formatLocalTime({ iso: ship.result.mergedAt })}</p>}
				{ship.result.failingChecks.length === 0 ? null : <p>Failing checks: {ship.result.failingChecks.join(', ')}</p>}
			</div>
		)}
		{ship.steps.length === 0 ? null : (
			<ol className="flex flex-col gap-1" aria-label="Ship steps">
				{ship.steps.map((step) => (
					<li key={step.id} className="flex flex-wrap gap-x-4">
						<span className="font-mono">{step.id}</span>
						<span>{step.status ?? 'not reached'}</span>
						<span className="text-muted-foreground">{formatDuration({ ms: step.durationMs })}</span>
					</li>
				))}
			</ol>
		)}
	</div>
);

interface Props {
	evidence: PlanEvidence;
}

/** The run's status is stated first, so a summary of a paused or failed build never reads as a finished one. A section whose step never ran is not drawn. */
export const PlanEvidenceDetail = ({ evidence }: Props) => (
	<div className="flex flex-col gap-8">
		{evidence.runStatus === undefined ? null : (
			<p className="text-sm">
				Build run status: <MetadataTag>{evidence.runStatus}</MetadataTag>
			</p>
		)}
		{evidence.problems.length === 0 ? null : (
			<ul className="flex list-disc flex-col gap-1 rounded-2xl border border-border bg-muted/40 py-4 pr-5 pl-10 text-sm">
				{evidence.problems.map((problem) => (
					<li key={problem}>{problem}</li>
				))}
			</ul>
		)}
		<EvidenceHeadlineRow headline={evidence.headline} />
		{evidence.lines === undefined ? null : (
			<div className={figureRowClass}>
				<EvidenceFigure label="Lines added" count={evidence.lines.added} />
				<EvidenceFigure label="Lines removed" count={evidence.lines.removed} />
			</div>
		)}
		{evidence.plan === undefined ? null : (
			<EvidenceSection title="Plan" state={evidence.plan.state}>
				<EvidencePlanPart plan={evidence.plan} />
			</EvidenceSection>
		)}
		{evidence.tests === undefined ? null : (
			<EvidenceSection title="Tests" state={evidence.tests.state}>
				<TestsPart tests={evidence.tests} />
			</EvidenceSection>
		)}
		{evidence.checks === undefined ? null : (
			<EvidenceSection title="Checks" state={evidence.checks.state}>
				<ChecksPart checks={evidence.checks} />
			</EvidenceSection>
		)}
		{evidence.cleanup === undefined ? null : (
			<EvidenceSection title="Cleanup" state={evidence.cleanup.state}>
				<EvidenceCleanupPart cleanup={evidence.cleanup} />
			</EvidenceSection>
		)}
		{evidence.agents === undefined ? null : (
			<EvidenceSection title="Agents" state={evidence.agents.state}>
				<EvidenceAgentsPart agents={evidence.agents} />
			</EvidenceSection>
		)}
		{evidence.ship === undefined ? null : (
			<EvidenceSection title="Ship" state={evidence.ship.state}>
				<ShipPart ship={evidence.ship} />
			</EvidenceSection>
		)}
	</div>
);
