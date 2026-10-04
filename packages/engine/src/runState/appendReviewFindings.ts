import { appendJsonlRecords } from '#src/common/json/appendJsonlRecords.ts';
import { ReviewFindingRecord } from '#src/contracts/standardsCheck/ReviewFindingRecord.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { getReviewFindingsPath } from '#src/runState/common/getReviewFindingsPath.ts';

interface Params {
	/** The checkout the run works in — a linked worktree during an isolated run; the primary is resolved from it. */
	cwd: string;
	runId: string;
	/** The batch that was working when the review ran. */
	step: string;
	findings: StandardsFinding[];
}

/**
 * Called the moment a review reports them, before anything is spent acting on
 * them: a run that parks or escalates never builds its batch report, and no
 * deterministic check can rediscover an agent-check finding, so an unwritten one is gone.
 */
export const appendReviewFindings = async ({ cwd, runId, step, findings }: Params): Promise<void> =>
	appendJsonlRecords({ path: await getReviewFindingsPath({ cwd }), schema: ReviewFindingRecord, entries: findings, runId, step });
