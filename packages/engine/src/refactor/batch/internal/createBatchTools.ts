import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { runBatchGates } from '#src/gates/runBatchGates.ts';
import { standaloneBanner } from '#src/refactor/batch/internal/common/constants/standaloneBanner.ts';
import type { BatchTools } from '#src/refactor/batch/internal/common/types/BatchTools.ts';
import { createBatchRecorder } from '#src/refactor/batch/internal/createBatchRecorder.ts';
import { createSiteChecker } from '#src/refactor/batch/internal/createSiteChecker.ts';
import { invokeBatchAgent } from '#src/refactor/batch/internal/invokeBatchAgent.ts';
import { settleBatchGates } from '#src/refactor/batch/internal/settleBatchGates.ts';
import { reviewBatchOutput } from '#src/refactor/batch/reviewBatchOutput.ts';

interface Params {
	cwd: string;
	runId: string;
	driver: Driver;
	config: LightsoutConfig;
	batch: RefactorBatch;
	groups: StandardsGroup[];
	/** Monorepo package parent dir, handed to the output review so it grades each finding by its file's package group. */
	packagesDir: string;
	/** false skips the review of what the batch wrote — deterministic-checks-only mode. */
	agentReview: boolean;
	/** Check scope of the run's worklist, threaded into the per-batch re-check. */
	checkPath?: string;
	/** Must match the worklist's mode. */
	checkAll: boolean;
	agentTimeoutMs: number;
	/** Excluded from this batch's git-truth merge. */
	attributedFiles: string[];
	onProgress: (message: string) => void;
	recordUsage: (params: { step: string; usage?: AgentUsage }) => Promise<void>;
}

/** Created together because they share mutable batch-level state that two copies could disagree about. */
export const createBatchTools = ({
	cwd,
	runId,
	driver,
	config,
	batch,
	groups,
	packagesDir,
	agentReview,
	checkPath,
	checkAll,
	agentTimeoutMs,
	attributedFiles,
	onProgress,
	recordUsage,
}: Params): BatchTools => {
	const { rationale, reportedFiles, advisoryOutcomes, reportOf, changedFiles, finish } = createBatchRecorder({ cwd, config, attributedFiles });
	const { checkLive, remainingSiteKeys } = createSiteChecker({ cwd, config, checkPath, checkAll });
	let invocationCount = 0;

	const invoke = ({ label, invocation }: { label: string; invocation: { systemPrompt: string; prompt: string } }) => {
		invocationCount += 1;

		return invokeBatchAgent({
			cwd,
			runId,
			driver,
			config,
			batch,
			invocation,
			label,
			invocationCount,
			agentTimeoutMs,
			reportedFiles,
			rationale,
			advisoryOutcomes,
			onProgress,
			recordUsage,
		});
	};

	const reviewOutput = async ({ baseline }: { baseline: StandardsFinding[] }) =>
		reviewBatchOutput({
			cwd,
			runId,
			driver,
			batch,
			groups,
			packagesDir,
			agentReview,
			baseline,
			changedFiles: await changedFiles(),
			timeoutMs: agentTimeoutMs,
			onProgress,
		});

	// Coverage stays on: a refactor must not drop coverage.
	const gates = () => runBatchGates({ cwd, config, coverage: true, runId, step: batch.id, onProgress });

	const settle = ({ invokeFix }: { invokeFix: Parameters<typeof settleBatchGates>[0]['invokeFix'] }) =>
		settleBatchGates({
			cwd,
			runId,
			driver,
			config,
			batchId: batch.id,
			planContent: standaloneBanner,
			attempts: invocationCount,
			onProgress,
			recordUsage,
			invokeFix,
			gates,
		});

	return { invoke, reportOf, finish, gates, checkLive, remainingSiteKeys, reviewOutput, settle, rationale };
};
