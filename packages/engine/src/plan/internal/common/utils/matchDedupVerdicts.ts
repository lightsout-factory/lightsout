import type { DedupFinding } from '#src/contracts/dedup/DedupFinding.ts';
import type { DedupVerdict } from '#src/contracts/dedup/DedupVerdict.ts';
import type { PriorArtCandidate } from '#src/plan/internal/common/types/PriorArtCandidate.ts';

interface Params {
	candidates: PriorArtCandidate[];
	/** In whatever order and completeness the judge returned them. */
	verdicts: DedupVerdict[];
}

/**
 * The detected candidates drive the loop: a verdict about a symbol nobody
 * detected is discarded, because a finding must carry the real `collidesWith`
 * locations a human is about to go read. An unjudged candidate is dropped too:
 * silence is not a confirmation.
 */
export const matchDedupVerdicts = ({ candidates, verdicts }: Params): DedupFinding[] => {
	const verdictBySymbol = new Map(verdicts.map((verdict) => [verdict.plannedSymbol, verdict]));

	return candidates.flatMap((candidate) => {
		const verdict = verdictBySymbol.get(candidate.plannedSymbol);

		if (!verdict?.isDuplicate) {
			return [];
		}

		return [
			{
				plannedSymbol: candidate.plannedSymbol,
				plannedPath: candidate.plannedPath,
				phase: candidate.phase,
				collidesWith: candidate.collidesWith,
				recommendation: verdict.recommendation,
				rationale: verdict.rationale,
				suggestedLocation: verdict.suggestedLocation,
				migrateCallers: verdict.migrateCallers,
			},
		];
	});
};
