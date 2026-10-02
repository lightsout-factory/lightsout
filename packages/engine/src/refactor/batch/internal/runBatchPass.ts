import { buildRefactorExecutorInvocation } from '#src/agents/buildRefactorExecutorInvocation.ts';
import { RefactorScope } from '#src/common/constants/RefactorScope.ts';
import { BatchOutcome } from '#src/contracts/refactor/BatchOutcome.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { getAttemptStop } from '#src/refactor/batch/getAttemptStop.ts';
import { SettleKind } from '#src/refactor/batch/internal/common/constants/SettleKind.ts';
import { standaloneBanner } from '#src/refactor/batch/internal/common/constants/standaloneBanner.ts';
import type { BatchTools } from '#src/refactor/batch/internal/common/types/BatchTools.ts';
import type { PassOutcome } from '#src/refactor/batch/internal/common/types/PassOutcome.ts';
import { createFixInvoker } from '#src/refactor/batch/internal/createFixInvoker.ts';
import { polishBatchOutput } from '#src/refactor/batch/polishBatchOutput.ts';
import { BatchStopKind } from '#src/refactor/internal/common/constants/BatchStopKind.ts';

interface Params {
	tools: BatchTools;
	batch: RefactorBatch;
	/** 1 for the initial pass, 2 for the single requeue. */
	pass: number;
	/** The findings this pass must resolve — the whole batch on pass 1, the survivors on the requeue. */
	workFindings: StandardsFinding[];
	advisories: StandardsFinding[];
	standards?: string;
	testStandards?: string;
	onProgress: (message: string) => void;
}

/** The caller decides whether there is a requeue left to spend on what survives. */
export const runBatchPass = async ({ tools, batch, pass, workFindings, advisories, standards, testStandards, onProgress }: Params): Promise<PassOutcome> => {
	const files = [...new Set(workFindings.flatMap((finding) => finding.files.map((file) => file.path)))];

	const attempt = await tools.invoke({
		label: pass === 1 ? '' : 'requeue',
		invocation: buildRefactorExecutorInvocation({
			scope: RefactorScope.Standalone,
			planContent: standaloneBanner,
			changedFiles: files,
			standards,
			findings: workFindings,
			advisories,
			reportAdvisoryOutcomes: true,
		}),
	});
	const changedNothing = attempt.ok && attempt.report.changedFiles.length === 0;
	const stop = await getAttemptStop({
		batchId: batch.id,
		attempt,
		workFindings,
		rationale: tools.rationale,
		onProgress,
		remainingSiteKeys: tools.remainingSiteKeys,
		gates: tools.gates,
		finish: tools.finish,
	});

	let outcome: PassOutcome | undefined = stop === undefined ? undefined : { stop };

	if (outcome === undefined) {
		const settled = await tools.settle({ invokeFix: createFixInvoker({ tools, files, workFindings, advisories, standards, testStandards }) });

		if (settled.kind === SettleKind.Parked) {
			outcome = { stop: { kind: BatchStopKind.Parked } };
		} else if (settled.kind === SettleKind.Escalated) {
			outcome = { stop: { kind: BatchStopKind.Escalated, error: settled.error } };
		} else {
			const remaining = await tools.remainingSiteKeys({ frozen: workFindings });

			if (remaining.length === 0) {
				outcome = { stop: await polishBatchOutput({ tools, batch, baseline: advisories, workFindings, standards, testStandards, onProgress }) };
			} else if (changedNothing) {
				// A pass that changed nothing is a judged decline; it never fails the run by itself.
				outcome = { stop: await tools.finish({ outcome: BatchOutcome.Declined, remainingSiteKeys: remaining }) };
			} else {
				onProgress(`${batch.id}: ${remaining.length} site(s) persist after a changing pass`);
				outcome = { workFindings: workFindings.filter((finding) => remaining.includes(finding.siteKey)) };
			}
		}
	}

	return outcome;
};
