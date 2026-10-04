import { BuildMode } from '#src/common/constants/BuildMode.ts';
import type { PlanBuildMode } from '#src/common/types/PlanBuildMode.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import { reviewTestChanges } from '#src/pipeline/approvedTests/reviewTestChanges.ts';
import type { VerificationResult } from '#src/pipeline/internal/common/types/VerificationResult.ts';
import { runVerificationGates } from '#src/pipeline/internal/common/utils/runVerificationGates.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { checkMoveOnlyChanges } from '#src/pipeline/moveCheck/checkMoveOnlyChanges/checkMoveOnlyChanges.ts';
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
	/** The phase's build mode, which decides what judges the checkpoint's changes before the gates. */
	planBuildMode: PlanBuildMode;
}

const judgeChanges = async ({
	run,
	id,
	planContent,
	overviewContent,
	planBuildMode,
}: {
	run: PipelineRun;
	id: string;
	planContent: string;
	overviewContent?: string;
	planBuildMode: PlanBuildMode;
}) => {
	let error: string | undefined;
	let family: string;
	let rateLimited = false;

	switch (planBuildMode.buildMode) {
		case BuildMode.RenamesOnly:
			({ error } = await checkRenameOnlyChanges({ run, checkpoint: id, renames: planBuildMode.renames }));
			family = 'rename-check';
			break;
		case BuildMode.MoveFoldersAndFiles:
			({ error } = await checkMoveOnlyChanges({ run, checkpoint: id, fileMoves: planBuildMode.fileMoves, folderMoves: planBuildMode.folderMoves }));
			family = 'move-check';
			break;
		default: {
			const review = await reviewTestChanges({ run, checkpoint: id, planContent, overviewContent });

			error = review.error;
			family = 'test-review';
			rateLimited = review.rateLimited === true;
		}
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
	planBuildMode,
}: Params): Promise<{ rateLimited: true } | VerificationResult> => {
	const judgment = await judgeChanges({ run, id, planContent, overviewContent, planBuildMode });

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

	// A move-folders-and-files phase writes no tests, and its move check would
	// refuse any written, so it cannot answer for every changed file being executed.
	const result = await runVerificationGates({
		run,
		coverage,
		checkpoint: id,
		rows: acceptanceTests(),
		final,
		changedFilesExecuted: planBuildMode.buildMode !== BuildMode.MoveFoldersAndFiles,
	});

	// Whatever the verdict: jest writes a brand-new snapshot itself during the
	// gate run, and the runner's own output must not arrive at the next
	// checkpoint as somebody's edit to a test.
	await approveRunnerSnapshots({ run });

	return result;
};
