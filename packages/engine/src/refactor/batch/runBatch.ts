import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { BatchOutcome } from '#src/contracts/refactor/BatchOutcome.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { collectBatchAdvisories } from '#src/refactor/batch/collectBatchAdvisories.ts';
import { createBatchTools } from '#src/refactor/batch/internal/createBatchTools.ts';
import { runBatchPass } from '#src/refactor/batch/internal/runBatchPass.ts';
import { readStandingWork } from '#src/refactor/batch/readStandingWork.ts';
import { BatchStopKind } from '#src/refactor/internal/common/constants/BatchStopKind.ts';
import type { BatchStop } from '#src/refactor/internal/common/types/BatchStop.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';

interface Params {
	cwd: string;
	runId: string;
	driver: Driver;
	config: LightsoutConfig;
	batch: RefactorBatch;
	packs: LoadedStandardsLibrary[];
	channels: string[];
	/** Check scope of the run's worklist, threaded into the per-batch re-check. */
	checkPath?: string;
	/** Must match the worklist's mode. */
	checkAll: boolean;
	/** false skips both of this batch's agent reviews — the pre-edit read and the read of what it wrote. Code-checks-only mode. */
	agentReview: boolean;
	standards?: string;
	testStandards?: string;
	agentTimeoutMs: number;
	/** Excluded from this batch's git-truth merge. */
	attributedFiles: string[];
	onProgress: (message: string) => void;
	recordUsage: (params: { step: string; usage?: AgentUsage }) => Promise<void>;
}

export const runBatch = async ({
	cwd,
	runId,
	driver,
	config,
	batch,
	packs,
	channels,
	checkPath,
	checkAll,
	agentReview,
	standards,
	testStandards,
	agentTimeoutMs,
	attributedFiles,
	onProgress,
	recordUsage,
}: Params): Promise<BatchStop> => {
	const tools = createBatchTools({
		cwd,
		runId,
		driver,
		config,
		batch,
		packs,
		channels,
		agentReview,
		checkPath,
		checkAll,
		agentTimeoutMs,
		attributedFiles,
		onProgress,
		recordUsage,
	});

	// Live rather than frozen: earlier batches may have already cleared these
	// sites, and frozen advisories cite pre-run line numbers.
	const preCheck = await tools.checkLive();
	const standing = readStandingWork({ batch, findings: preCheck.findings, onProgress });

	if (standing.length === 0) {
		onProgress(`${batch.id}: sites already resolved by earlier work — no agent spent`);

		return { kind: BatchStopKind.Done, report: tools.reportOf({ outcome: BatchOutcome.Resolved, remainingSiteKeys: [] }), changedFiles: [] };
	}

	const advisories = await collectBatchAdvisories({
		cwd,
		runId,
		driver,
		batch,
		packs,
		channels,
		findings: preCheck.findings,
		agentReview,
		timeoutMs: agentTimeoutMs,
		onProgress,
	});

	const passBudget = 2;
	let workFindings: StandardsFinding[] = standing;
	let stop: BatchStop | undefined;

	for (let pass = 1; pass <= passBudget && stop === undefined; pass += 1) {
		const passed = await runBatchPass({ tools, batch, pass, workFindings, advisories, standards, testStandards, onProgress });

		if ('stop' in passed) {
			stop = passed.stop;
		} else {
			workFindings = passed.workFindings;
		}
	}

	return stop ?? (await tools.finish({ outcome: BatchOutcome.Declined, remainingSiteKeys: workFindings.map((finding) => finding.siteKey) }));
};
