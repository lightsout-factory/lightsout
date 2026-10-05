import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { matchRemainingFindings } from '#src/refactor/batch/runBatch/common/matchRemainingFindings.ts';

interface Params {
	batch: RefactorBatch;
	/** Everything the live pre-check found, from which this batch's own sites are picked out. */
	findings: StandardsFinding[];
	onProgress: (message: string) => void;
}

/**
 * Read live rather than from the frozen work-list: an earlier batch may have
 * fixed a site, and the frozen copy cites pre-run line numbers. A shorter list is
 * announced because the original count was already printed.
 */
export const readStandingWork = ({ batch, findings, onProgress }: Params): StandardsFinding[] => {
	const standing = new Set(matchRemainingFindings({ frozen: batch.blocking, live: findings }));

	if (standing.size > 0 && standing.size < batch.blocking.length) {
		onProgress(
			`${batch.id}: ${batch.blocking.length - standing.size} of ${batch.blocking.length} site(s) already resolved by earlier work — working the ${standing.size} still standing`,
		);
	}

	return findings.filter((finding) => standing.has(finding.siteKey));
};
