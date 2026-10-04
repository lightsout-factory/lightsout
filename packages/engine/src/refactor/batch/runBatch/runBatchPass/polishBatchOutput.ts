import { buildRefactorExecutorInvocation } from '#src/agents/buildRefactorExecutorInvocation.ts';
import { RefactorScope } from '#src/common/constants/RefactorScope.ts';
import { BatchOutcome } from '#src/contracts/refactor/BatchOutcome.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { SettleKind } from '#src/refactor/batch/common/constants/SettleKind.ts';
import { standaloneBanner } from '#src/refactor/batch/runBatch/common/constants/standaloneBanner.ts';
import type { BatchTools } from '#src/refactor/batch/runBatch/common/types/BatchTools.ts';
import { createFixInvoker } from '#src/refactor/batch/runBatch/runBatchPass/common/constants/createFixInvoker/createFixInvoker.ts';
import { BatchStopKind } from '#src/refactor/common/constants/BatchStopKind.ts';
import type { BatchStop } from '#src/refactor/common/types/BatchStop.ts';

interface Params {
	tools: BatchTools;
	batch: RefactorBatch;
	/** The pre-edit advisories, which the executor already answered. */
	baseline: StandardsFinding[];
	/** Re-checked after the polish, so a polish that revives one cannot pass unnoticed. */
	workFindings: StandardsFinding[];
	standards?: string;
	testStandards?: string;
	onProgress: (message: string) => void;
}

/**
 * Green gates and cleared sites say nothing about the shape of the replacement
 * code: a check standing in for a judgment can be satisfied by code the
 * judgment would reject.
 *
 * One pass, deliberately: these findings are advisory, and an unbounded
 * review-fix loop would let an agent-checked rule spend the run arguing with itself.
 * A polish that revives a cleared site is a decline, not a pass.
 */
export const polishBatchOutput = async ({ tools, batch, baseline, workFindings, standards, testStandards, onProgress }: Params): Promise<BatchStop> => {
	const resolve = () => tools.finish({ outcome: BatchOutcome.Resolved, remainingSiteKeys: [] });
	const introduced = await tools.reviewOutput({ baseline });

	if (introduced.length === 0) {
		return resolve();
	}

	const files = [...new Set(introduced.flatMap((finding) => finding.files.map((file) => file.path)))];

	onProgress(`${batch.id}: the review of what this batch wrote raised ${introduced.length} new advisory(s) — spending one polish pass`);

	await tools.invoke({
		label: 'polish',
		invocation: buildRefactorExecutorInvocation({
			scope: RefactorScope.Standalone,
			planContent: standaloneBanner,
			changedFiles: files,
			standards,
			advisories: introduced,
			reportAdvisoryOutcomes: true,
		}),
	});

	const settled = await tools.settle({ invokeFix: createFixInvoker({ tools, files, workFindings, advisories: introduced, standards, testStandards }) });

	if (settled.kind === SettleKind.Parked) {
		return { kind: BatchStopKind.Parked };
	}

	if (settled.kind === SettleKind.Escalated) {
		return { kind: BatchStopKind.Escalated, error: settled.error };
	}

	const revived = await tools.remainingSiteKeys({ frozen: workFindings });

	if (revived.length === 0) {
		return resolve();
	}

	onProgress(`${batch.id}: the polish pass brought back ${revived.length} site(s) this batch had cleared — recorded as declined`);

	return tools.finish({ outcome: BatchOutcome.Declined, remainingSiteKeys: revived });
};
