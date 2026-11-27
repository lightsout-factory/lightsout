import { type EvidenceHeadline, EvidenceProvenance } from '@lightsout/engine/contracts';
import { formatCost, formatDuration } from '@lightsout/shared';
import { EvidenceFigure } from '#src/features/workOrders/components/EvidenceFigure.tsx';

interface Props {
	headline: EvidenceHeadline;
}

/** Derived here rather than stored, so an unmerged plan's time counts on to now instead of freezing at fetch time. */
const PlanTime = ({ startedAt, mergedAt }: { startedAt: string; mergedAt: string | undefined }) => {
	const endMs = mergedAt === undefined ? Date.now() : Date.parse(mergedAt);
	const ms = Math.max(0, endMs - Date.parse(startedAt));

	return (
		<EvidenceFigure
			label={mergedAt === undefined ? 'Elapsed so far (unmerged)' : 'Plan to merge'}
			count={{ value: ms, provenance: EvidenceProvenance.Measured }}
			text={formatDuration({ ms })}
		/>
	);
};

/** An absent figure is left out rather than drawn as zero; with none at all the row says so. */
export const EvidenceHeadlineRow = ({ headline }: Props) => {
	const { startedAt, mergedAt, questionsAsked, recordedCostUsd, findingsFixed } = headline;

	if (startedAt === undefined && questionsAsked === undefined && recordedCostUsd === undefined && findingsFixed === undefined) {
		return <p className="text-muted-foreground text-sm">No evidence recorded yet.</p>;
	}

	return (
		<div className="flex flex-wrap gap-x-8 gap-y-3">
			{startedAt === undefined ? null : <PlanTime startedAt={startedAt} mergedAt={mergedAt} />}
			{questionsAsked === undefined ? null : <EvidenceFigure label="Questions asked of you" count={questionsAsked} />}
			{recordedCostUsd === undefined ? null : (
				<EvidenceFigure label="Recorded cost" count={recordedCostUsd} text={formatCost({ usd: recordedCostUsd.value })} />
			)}
			{findingsFixed === undefined ? null : <EvidenceFigure label="Standards findings fixed" count={findingsFixed} />}
		</div>
	);
};
