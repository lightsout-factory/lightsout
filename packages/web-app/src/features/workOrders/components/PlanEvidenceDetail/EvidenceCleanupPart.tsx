import { EvidenceSectionState, type PlanEvidence } from '@lightsout/engine/contracts';
import { MetadataTag } from '#src/components/ui/MetadataTag.tsx';
import { EvidenceFigure } from '#src/features/workOrders/components/EvidenceFigure.tsx';

type Cleanup = NonNullable<PlanEvidence['cleanup']>;

type Standards = NonNullable<Cleanup['standards']>;

/** One standards finding per row: its rule as the library names it, and the files it stands in. */
const FindingList = ({ title, findings }: { title: string; findings: Standards['fixed'] }) =>
	findings.length === 0 ? null : (
		<div className="flex flex-col gap-2">
			<h3 className="font-semibold text-sm">{title}</h3>
			<ul className="flex flex-col gap-1 text-sm">
				{findings.map((finding) => (
					<li key={`${finding.rule}-${finding.files.join(',')}`} className="flex flex-wrap gap-x-3">
						<span className="font-mono">{finding.rule}</span>
						<span className="font-mono text-muted-foreground text-xs">{finding.files.join(', ')}</span>
					</li>
				))}
			</ul>
		</div>
	);

/** A finished cleanup handed nothing says so in words, so an empty list never reads as a clean result it did not earn. */
const StandardsFigures = ({ standards }: { standards: Standards }) => {
	const handedNothing = standards.state === EvidenceSectionState.Finished && standards.found?.value === 0 && standards.remaining.length === 0;

	return (
		<div className="flex flex-col gap-4">
			{standards.state === EvidenceSectionState.InProgress ? (
				<span>
					<MetadataTag>In progress</MetadataTag>
				</span>
			) : null}
			{handedNothing ? <p className="text-sm">No blocking findings handed to cleanup</p> : null}
			<div className="flex flex-wrap gap-x-8 gap-y-2">
				{standards.found === undefined ? null : <EvidenceFigure label="Standards findings found" count={standards.found} />}
				{standards.found === undefined ? null : (
					<EvidenceFigure label="Standards findings fixed" count={{ value: standards.fixed.length, provenance: standards.found.provenance }} />
				)}
				<EvidenceFigure label="Carried, not fixed" count={standards.carried} />
				<EvidenceFigure label="Review findings" count={standards.reviewFindings} />
			</div>
			<FindingList title="Fixed" findings={standards.fixed} />
			<FindingList title="Remaining" findings={standards.remaining} />
		</div>
	);
};

const describeMatches = ({ matches }: { matches: string[] }) => (matches.length === 0 ? 'found nothing' : `found ${matches.join(', ')}`);

/** What an agent searched for before writing something new and what the search turned up — a match found, never a claim that it was used. */
const SearchList = ({ searches }: { searches: Cleanup['searches'] }) =>
	searches.length === 0 ? null : (
		<div className="flex flex-col gap-2">
			<h3 className="font-semibold text-sm">Searches for existing code</h3>
			<ul className="flex flex-col gap-1 text-sm">
				{searches.map((search) => (
					<li key={search.symbol} title={search.symbol}>
						Searched <span className="font-mono">{search.searches.join(', ')}</span> — {describeMatches({ matches: search.matches })}
					</li>
				))}
			</ul>
		</div>
	);

interface Props {
	cleanup: Cleanup;
}

/** A cleanup that never ran has no figures at all, so it never reads as one that ran clean. */
export const EvidenceCleanupPart = ({ cleanup }: Props) => (
	<div className="flex flex-col gap-5">
		{cleanup.standards === undefined ? (
			<p className="text-muted-foreground text-sm">Cleanup has not run</p>
		) : (
			<StandardsFigures standards={cleanup.standards} />
		)}
		{cleanup.duplicates === undefined ? null : <EvidenceFigure label="Duplicates found before the build" count={cleanup.duplicates} />}
		<SearchList searches={cleanup.searches} />
	</div>
);
