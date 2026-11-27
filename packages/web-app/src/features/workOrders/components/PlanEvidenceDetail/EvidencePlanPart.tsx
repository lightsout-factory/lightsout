import type { PlanEvidence } from '@lightsout/engine/contracts';
import { EvidenceFigure } from '#src/features/workOrders/components/EvidenceFigure.tsx';
import { formatLocalTime } from '#src/utils/formatLocalTime.ts';

interface Props {
	plan: NonNullable<PlanEvidence['plan']>;
}

/** How planning went: each grading pass, the grader's findings by how they were settled, the questions, and the paths confirmed against the code. */
export const EvidencePlanPart = ({ plan }: Props) => (
	<div className="flex flex-col gap-4">
		{plan.gradePasses.length === 0 ? (
			<p className="text-muted-foreground text-sm">No grading passes recorded.</p>
		) : (
			<ol className="flex flex-col gap-2" aria-label="Grading passes">
				{plan.gradePasses.map((pass, index) => (
					<li key={pass.gradedAt} className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
						<span className="font-semibold text-sm">
							Pass {index + 1} · Grade {pass.grade}
						</span>
						<EvidenceFigure label="Gaps" count={pass.gaps} />
						<EvidenceFigure label="Structural findings" count={pass.structural} />
						<span className="text-muted-foreground text-xs">{formatLocalTime({ iso: pass.gradedAt })}</span>
					</li>
				))}
			</ol>
		)}
		{plan.findingsByStatus.length === 0 ? null : (
			<div className="flex flex-wrap gap-x-8 gap-y-2">
				{plan.findingsByStatus.map(({ status, count }) => (
					<EvidenceFigure key={status} label={`Grader findings ${status}`} count={count} />
				))}
			</div>
		)}
		<div className="flex flex-wrap gap-x-8 gap-y-2">
			{plan.questionsAsked === undefined ? null : <EvidenceFigure label="Questions asked of you" count={plan.questionsAsked} />}
			{plan.answeredWithoutUser === undefined ? null : <EvidenceFigure label="Answered without you" count={plan.answeredWithoutUser} />}
		</div>
		<div className="flex flex-wrap gap-x-8 gap-y-2">
			{plan.pathsChecked === undefined ? null : <EvidenceFigure label="Paths checked against the code" count={plan.pathsChecked} />}
			{plan.pathsMissing === undefined ? null : <EvidenceFigure label="Paths missing" count={plan.pathsMissing} />}
			{plan.scriptsChecked === undefined ? null : <EvidenceFigure label="Scripts checked against the code" count={plan.scriptsChecked} />}
			{plan.scriptsMissing === undefined ? null : <EvidenceFigure label="Scripts missing" count={plan.scriptsMissing} />}
		</div>
	</div>
);
