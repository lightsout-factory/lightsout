import type { DedupReport } from '@lightsout/engine/contracts';
import { MetadataTag } from '#src/components/ui/MetadataTag.tsx';

const noteClass = 'text-muted-foreground text-sm';

const reviewedText = ({ count }: { count: number }) => `${count} ${count === 1 ? 'collision' : 'collisions'} reviewed`;

const Findings = ({ findings }: { findings: DedupReport['findings'] }) => (
	<ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Duplicates">
		{findings.map((finding) => (
			<li key={`${finding.phase}-${finding.plannedPath}-${finding.plannedSymbol}`} className="flex flex-col gap-2 px-5 py-4 text-sm leading-6">
				<p className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<span className="font-mono font-semibold">{finding.plannedSymbol}</span>
					<MetadataTag>{finding.recommendation}</MetadataTag>
					<span className="font-mono text-muted-foreground text-xs">{finding.plannedPath}</span>
					<span className="font-mono text-muted-foreground text-xs">{finding.phase}</span>
				</p>
				<p>{finding.rationale}</p>
				{finding.collidesWith.length === 0 ? null : (
					<ul className="list-disc pl-6 font-mono text-xs">
						{finding.collidesWith.map((collision) => (
							<li key={`${collision.path}-${collision.name}`}>
								{collision.name} · {collision.path}
							</li>
						))}
					</ul>
				)}
				{finding.suggestedLocation === undefined ? null : <p className="font-mono text-muted-foreground text-xs">{finding.suggestedLocation}</p>}
			</li>
		))}
	</ul>
);

interface Props {
	/** `dedup.json` as parsed; absent before the duplicate check has run. */
	dedup: DedupReport | undefined;
}

/** An unfinished scan is said so before anything else, so an empty list never reads as a clean result it did not earn. */
export const DedupDetail = ({ dedup }: Props) => {
	if (dedup === undefined) {
		return <p className={noteClass}>Not checked for duplicates yet.</p>;
	}

	return (
		<div className="flex flex-col gap-5">
			{dedup.complete ? null : <p className="text-sm">{dedup.incompleteReason === undefined ? 'Incomplete' : `Incomplete — ${dedup.incompleteReason}`}</p>}
			{dedup.findings.length === 0 && dedup.complete ? <p className="text-sm">No duplicates found</p> : null}
			{dedup.findings.length === 0 ? null : <Findings findings={dedup.findings} />}
			<p className={noteClass}>{reviewedText({ count: dedup.reviewed.length })}</p>
		</div>
	);
};
