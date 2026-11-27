import { GapOutcome, GradeFindingStatus, type PlanWorkspaceView } from '@lightsout/engine/contracts';
import { MetadataTag } from '#src/components/ui/MetadataTag.tsx';
import { formatLocalTime } from '#src/utils/formatLocalTime.ts';

type Pass = PlanWorkspaceView['gradePasses'][number];

type Finding = PlanWorkspaceView['gradeFindings'][number];

/** One thing the grader raised, whichever file it was read from. */
interface Raised {
	key: string;
	question: string;
	gap: string;
	/** Who the grader said had to settle it; absent when no judge ruled. */
	ruling?: string;
	/** Where the finding stands now; absent when no record of it was kept. */
	settled?: string;
}

const noteClass = 'text-muted-foreground text-sm';

const rulingLabels: Record<GapOutcome, string> = {
	[GapOutcome.NeedsAHuman]: 'Needed a decision',
	[GapOutcome.AgentCanDecide]: 'Agent could decide',
	[GapOutcome.AlreadyAnswered]: 'Already answered',
	[GapOutcome.Unjudged]: 'Not ruled on',
};

const joined = ({ parts }: { parts: (string | undefined)[] }) => parts.filter((part) => part !== undefined).join(' — ');

/** What became of a finding, with the evidence its record holds for it. */
const settledText = ({ finding }: { finding: Finding }) => {
	const texts: Record<GradeFindingStatus, string> = {
		[GradeFindingStatus.Resolved]: joined({ parts: ['Resolved in the plan', finding.resolutions[0]?.answerAt] }),
		[GradeFindingStatus.Noted]: joined({ parts: ['Left to the builder', finding.agentDecision ?? finding.answerAt] }),
		[GradeFindingStatus.Open]: joined({ parts: ['Still open', finding.humanDecision] }),
		[GradeFindingStatus.Pending]: joined({ parts: ['Not ruled on yet', finding.unjudgedReason] }),
		[GradeFindingStatus.Superseded]: joined({ parts: ['Merged into another finding', finding.supersededBy] }),
	};

	return texts[finding.status];
};

const raisedFromFinding = ({ finding }: { finding: Finding }): Raised => ({
	key: finding.id,
	question: finding.decision,
	gap: finding.gap,
	ruling: finding.disposition === undefined ? undefined : rulingLabels[finding.disposition],
	settled: settledText({ finding }),
});

/** A pass's gap joined to the record the grader kept of it, so the row says how it ended and not only that it was raised. */
const raisedInPass = ({ pass, findings }: { pass: Pass; findings: Finding[] }): Raised[] =>
	pass.gaps.map((gap) => {
		const finding = findings.find((candidate) => candidate.id === gap.findingId);

		return {
			key: gap.findingId ?? `${gap.phase}-${gap.decision}`,
			question: gap.decision,
			gap: gap.gap,
			ruling: rulingLabels[gap.outcome],
			settled: finding === undefined ? undefined : settledText({ finding }),
		};
	});

const RaisedList = ({ raised }: { raised: Raised[] }) => (
	<ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
		{raised.map((entry) => (
			<li key={entry.key} className="flex flex-col gap-2 px-5 py-4 text-sm leading-6">
				<p className="font-semibold">{entry.question}</p>
				<p>{entry.gap}</p>
				{entry.ruling === undefined ? null : (
					<span>
						<MetadataTag>{entry.ruling}</MetadataTag>
					</span>
				)}
				{entry.settled === undefined ? null : <p className="text-muted-foreground">{entry.settled}</p>}
			</li>
		))}
	</ul>
);

const countText = ({ count, noun }: { count: number; noun: string }) => `${count} ${count === 1 ? noun : `${noun}s`}`;

/** What the pass found, in a line: a clean pass says so, because that line is the point the history is read for. */
const passSummary = ({ pass }: { pass: Pass }) => {
	const counts = [
		pass.gaps.length === 0 ? undefined : countText({ count: pass.gaps.length, noun: 'gap' }),
		pass.structural.length === 0 ? undefined : countText({ count: pass.structural.length, noun: 'structural finding' }),
	].filter((count) => count !== undefined);

	return counts.length === 0 ? 'Nothing found' : counts.join(' · ');
};

const PassItem = ({ pass, number, findings }: { pass: Pass; number: number; findings: Finding[] }) => (
	<li className="flex flex-col gap-3">
		<p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
			<span className="font-semibold">Pass {number}</span>
			<MetadataTag>Grade {pass.grade}</MetadataTag>
			<span>{passSummary({ pass })}</span>
			{pass.complete ? null : <span>{joined({ parts: ['Incomplete', pass.incompleteReason] })}</span>}
			<span className="text-muted-foreground text-xs">{formatLocalTime({ iso: pass.gradedAt })}</span>
		</p>
		{pass.gaps.length === 0 ? null : <RaisedList raised={raisedInPass({ pass, findings })} />}
	</li>
);

interface Props {
	/** Every grading pass, oldest first; empty where the ledger was never written, as on a machine that only fetched the plan. */
	passes: Pass[];
	/** Every finding the grader keeps across passes. */
	findings: Finding[];
}

/**
 * How the plan was improved by being graded: each pass in turn with what it
 * raised and how each point ended. Without the passes the findings are still
 * listed, since they travel with the plan and the passes do not.
 */
export const GradeHistory = ({ passes, findings }: Props) => {
	if (passes.length > 0) {
		return (
			<ol className="flex flex-col gap-8" aria-label="Grading passes">
				{passes.map((pass, index) => (
					<PassItem key={pass.gradedAt} pass={pass} number={index + 1} findings={findings} />
				))}
			</ol>
		);
	}

	return findings.length === 0 ? (
		<p className={noteClass}>No grading history yet.</p>
	) : (
		<RaisedList raised={findings.map((finding) => raisedFromFinding({ finding }))} />
	);
};
