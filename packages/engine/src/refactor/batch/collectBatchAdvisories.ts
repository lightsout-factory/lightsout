import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { runBatchReview } from '#src/refactor/batch/internal/runBatchReview.ts';
import type { LoadedStandardsPack } from '#src/standardsPacks/common/types/LoadedStandardsPack.ts';

interface Params {
	cwd: string;
	/** Provenance for the judgment ledger. */
	runId: string;
	driver: Driver;
	batch: RefactorBatch;
	packs: LoadedStandardsPack[];
	/** A document out of play is not reviewed. */
	channels: string[];
	/** A live check's findings, which the machine advisories are filtered out of. */
	findings: StandardsFinding[];
	/** false skips the agent's read entirely — code-checks-only mode. */
	agentReview: boolean;
	timeoutMs: number;
	onProgress: (message: string) => void;
}

/**
 * Machine advisories and the agent's read land in one list because the executor
 * treats them alike: judge, fix unless exempt, never block. Every advisory on the
 * batch's files is included, since one the agent never sees it can never judge.
 */
export const collectBatchAdvisories = async ({
	cwd,
	runId,
	driver,
	batch,
	packs,
	channels,
	findings,
	agentReview,
	timeoutMs,
	onProgress,
}: Params): Promise<StandardsFinding[]> => {
	const batchFiles = new Set(batch.blocking.flatMap((finding) => finding.files.map((file) => file.path)));
	const machine = findings.filter((finding) => finding.severity === StandardsSeverity.Advisory && finding.files.some((file) => batchFiles.has(file.path)));

	const reviewed = await runBatchReview({ cwd, runId, driver, batch, packs, channels, files: [...batchFiles], agentReview, timeoutMs, onProgress });

	return [...machine, ...reviewed];
};
