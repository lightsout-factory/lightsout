import type { RenameRule } from '#src/contracts/plan/renames/RenameRule.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import { reviewTestChanges } from '#src/pipeline/approvedTests/reviewTestChanges.ts';
import type { VerificationResult } from '#src/pipeline/internal/common/types/VerificationResult.ts';
import { runVerificationGates } from '#src/pipeline/internal/common/utils/runVerificationGates.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { checkRenameOnlyChanges } from '#src/pipeline/renameCheck/checkRenameOnlyChanges.ts';
import { approveRunnerSnapshots } from '#src/pipeline/steps/verify/internal/approveRunnerSnapshots.ts';

interface Params {
	run: PipelineRun;
	id: string;
	coverage?: boolean;
	final?: boolean;
	planContent: string;
	overviewContent?: string;
	/** The live acceptance-test mapping, read afresh at every call. */
	acceptanceTests: () => AcceptanceTestRecord[];
	/** The plan's declared renames; non-empty only for a rename-only plan. */
	renames: RenameRule[];
}

const judgeChanges = async ({
	run,
	id,
	planContent,
	overviewContent,
	renames,
}: {
	run: PipelineRun;
	id: string;
	planContent: string;
	overviewContent?: string;
	renames: RenameRule[];
}) => {
	let error: string | undefined;
	let family: string;
	let rateLimited = false;

	if (renames.length > 0) {
		({ error } = await checkRenameOnlyChanges({ run, checkpoint: id, renames }));
		family = 'rename-check';
	} else {
		const review = await reviewTestChanges({ run, checkpoint: id, planContent, overviewContent });

		error = review.error;
		family = 'test-review';
		rateLimited = review.rateLimited === true;
	}

	return { error, family, rateLimited };
};

/**
 * The judgment lands before the gates because an approved-away or weakened test makes a gate
 * prove the wrong thing. A refusal is the checkpoint's verdict with no gate spent, so its fix
 * role repairs it under the budget it already has. The mapping is a function because a
 * disposition approved at this checkpoint rewrites it.
 */
export const reviewAndVerify = async ({
	run,
	id,
	coverage,
	final,
	planContent,
	overviewContent,
	acceptanceTests,
	renames,
}: Params): Promise<{ rateLimited: true } | VerificationResult> => {
	const judgment = await judgeChanges({ run, id, planContent, overviewContent, renames });

	if (judgment.rateLimited) {
		return { rateLimited: true };
	}

	if (judgment.error !== undefined) {
		return {
			error: judgment.error,
			failedFamilies: [judgment.family],
			crashes: [],
			timeouts: [],
			coordination: undefined,
			failures: [],
		};
	}

	const result = await runVerificationGates({ run, coverage, checkpoint: id, rows: acceptanceTests(), final });

	// Whatever the verdict: jest writes a brand-new snapshot itself during the
	// gate run, and the runner's own output must not arrive at the next
	// checkpoint as somebody's edit to a test.
	await approveRunnerSnapshots({ run });

	return result;
};
