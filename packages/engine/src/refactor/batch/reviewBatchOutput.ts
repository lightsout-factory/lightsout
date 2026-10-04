import type { Driver } from '#src/common/types/Driver.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { runBatchReview } from '#src/refactor/batch/internal/runBatchReview.ts';
import { findIntroducedFindings } from '#src/refactor/findIntroducedFindings.ts';

interface Params {
	cwd: string;
	/** Provenance for the judgment ledger. */
	runId: string;
	driver: Driver;
	batch: RefactorBatch;
	groups: StandardsGroup[];
	/** The pre-edit advisories, machine and agent alike. */
	baseline: StandardsFinding[];
	/** The files the batch's agents actually claimed — the only code this run can have written. */
	changedFiles: string[];
	/** Monorepo package parent dir, handed to the review so it grades each finding by its file's package group. */
	packagesDir: string;
	/** false skips this read entirely — deterministic-checks-only mode. */
	agentReview: boolean;
	timeoutMs: number;
	onProgress: (message: string) => void;
}

/**
 * The pre-edit review only judges inherited code, so a batch can pass every gate
 * and still leave worse code behind. Only new advisories come back: the executor
 * already answered the old ones.
 *
 * Advisory, deliberately: two agent reads of the same file can honestly differ,
 * so a wrong finding costs one invocation, never a bad verdict.
 */
export const reviewBatchOutput = async ({
	cwd,
	runId,
	driver,
	batch,
	groups,
	baseline,
	changedFiles,
	packagesDir,
	agentReview,
	timeoutMs,
	onProgress,
}: Params): Promise<StandardsFinding[]> => {
	if (changedFiles.length === 0) {
		return [];
	}

	const reviewed = await runBatchReview({ cwd, runId, driver, batch, groups, files: changedFiles, packagesDir, agentReview, timeoutMs, onProgress });

	return findIntroducedFindings({ frozen: baseline, live: reviewed, severity: StandardsSeverity.Advisory });
};
