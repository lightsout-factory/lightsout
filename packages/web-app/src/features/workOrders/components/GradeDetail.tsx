import type { GradeReport } from '@lightsout/engine/contracts';
import { MetadataTag } from '#src/components/ui/MetadataTag.tsx';
import { formatLocalTime } from '#src/utils/formatLocalTime.ts';

type Gap = GradeReport['gaps'][number];

const noteClass = 'text-muted-foreground text-sm';

const listClass = 'flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm';

const itemClass = 'flex flex-col gap-2 px-5 py-4 text-sm leading-6';

const metaClass = 'flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs';

/** Whichever line the gap's outcome carries: the decision owed, the decision an agent would make, where the answer lives, or why nobody ruled. */
const gapResolution = ({ gap }: { gap: Gap }) => {
	const agent = gap.agentDecision === undefined ? undefined : [gap.agentDecision, gap.safeBecause].filter((part) => part !== undefined).join(' — ');

	return gap.humanDecision ?? agent ?? gap.answerAt ?? gap.unjudgedReason;
};

/** A report that did not finish is said so first, because an unfinished pass is never a clean bill whatever its letter. */
const verdictText = ({ grade }: { grade: GradeReport }) => {
	if (!grade.complete) {
		return grade.incompleteReason === undefined ? 'Incomplete' : `Incomplete — ${grade.incompleteReason}`;
	}

	return grade.passed ? 'Passed' : 'Did not pass';
};

const StructuralFindings = ({ findings }: { findings: GradeReport['structural'] }) => (
	<ul className={listClass} aria-label="Structural findings">
		{findings.map((finding) => (
			<li key={`${finding.check}-${finding.phase}-${finding.location}-${finding.issue}`} className={itemClass}>
				<p className={metaClass}>
					<MetadataTag>{finding.severity}</MetadataTag>
					<span className="font-mono">{finding.check}</span>
					<span className="font-mono">{finding.phase}</span>
					<span className="font-mono">{finding.location}</span>
				</p>
				<p>{finding.issue}</p>
				<p className="text-muted-foreground">{finding.fix}</p>
			</li>
		))}
	</ul>
);

const Gaps = ({ gaps }: { gaps: Gap[] }) => (
	<ul className={listClass} aria-label="Gaps">
		{gaps.map((gap) => {
			const resolution = gapResolution({ gap });

			return (
				<li key={`${gap.phase}-${gap.lens}-${gap.decision}`} className={itemClass}>
					<p className={metaClass}>
						<MetadataTag>{gap.outcome}</MetadataTag>
						<span className="font-mono">{gap.area}</span>
						<span className="font-mono">{gap.phase}</span>
					</p>
					<p className="font-semibold">{gap.decision}</p>
					<p>{gap.gap}</p>
					{resolution === undefined ? null : <p className="text-muted-foreground">{resolution}</p>}
				</li>
			);
		})}
	</ul>
);

interface Props {
	/** `grade.json` as parsed; absent before the plan is graded. */
	grade: GradeReport | undefined;
}

/** The grade with what earned it: the verdict, then every structural finding and gap the pass recorded. */
export const GradeDetail = ({ grade }: Props) => {
	if (grade === undefined) {
		return <p className={noteClass}>Not graded</p>;
	}

	return (
		<div className="flex flex-col gap-5">
			<p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
				<span className="font-semibold">Grade {grade.grade}</span>
				<span>{verdictText({ grade })}</span>
				<span className="text-muted-foreground text-xs">{formatLocalTime({ iso: grade.gradedAt })}</span>
			</p>
			{grade.structural.length === 0 ? null : <StructuralFindings findings={grade.structural} />}
			{grade.gaps.length === 0 ? null : <Gaps gaps={grade.gaps} />}
			{grade.structural.length === 0 && grade.gaps.length === 0 ? <p className={noteClass}>No findings.</p> : null}
		</div>
	);
};
