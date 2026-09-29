import type { CoverageBatchReport } from '#src/contracts/coverage/CoverageBatchReport.ts';
import { BatchOutcome } from '#src/contracts/refactor/BatchOutcome.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import type { measureCoverageBatch } from '#src/coverage/batch/internal/measureCoverageBatch.ts';
import { CoverageBatchStopKind } from '#src/coverage/internal/common/constants/CoverageBatchStopKind.ts';
import type { CoverageBatch } from '#src/coverage/internal/common/types/CoverageBatch.ts';
import type { CoverageBatchStop } from '#src/coverage/internal/common/types/CoverageBatchStop.ts';
import type { GateRunResult } from '#src/gates/common/types/GateRunResult.ts';
import type { AgentOutcome } from '#src/invoke/common/types/AgentOutcome.ts';

interface Params {
	batchId: string;
	batch: CoverageBatch;
	attempt: AgentOutcome<WorkReport>;
	/** Batch-level rationale collector: the salvage and decline notes accumulate here. */
	rationale: string[];
	onProgress: (message: string) => void;
	/** The tests-only verdict on what the batch has written — the error message, or undefined when only tests changed. */
	testsOnly: () => Promise<string | undefined>;
	measure: () => ReturnType<typeof measureCoverageBatch>;
	/** Run the batch's gates and answer their whole verdict — a red, a crash, or a run that never started. */
	gates: () => Promise<GateRunResult>;
	/** Build the batch's done stop — the caller's shared post-step, which attaches the rationale and the changed files. */
	finish: (params: { outcome: BatchOutcome; files: CoverageBatchReport['files'] }) => CoverageBatchStop;
}

const unmeasured = ({ batch }: { batch: CoverageBatch }) =>
	batch.files.map((file) => ({ path: file.path, beforePct: file.statementsPct, afterPct: file.statementsPct }));

/**
 * An agent can die after finishing its edits but before reporting: if coverage
 * verifiably moved and the gates are green, the work is done. Salvage never
 * waives the tests-only rule.
 */
const salvage = async ({
	batchId,
	failure,
	rationale,
	onProgress,
	testsOnly,
	measure,
	gates,
	finish,
}: Omit<Params, 'batch' | 'attempt'> & { failure: string }) => {
	const violation = await testsOnly();

	if (violation) {
		return { kind: CoverageBatchStopKind.Failed, error: violation };
	}

	const salvaged = await measure();
	let stop: CoverageBatchStop = { kind: CoverageBatchStopKind.Failed, error: `${batchId}: ${failure}` };

	// `.error` rather than the whole answer: work on disk is salvaged only when
	// the gates actually ran and came back green, and a gate run that never
	// started proves nothing about a dead agent's work.
	if (salvaged.improved && (await gates()).error === undefined) {
		rationale.push(`[other] salvaged: agent invocation failed (${failure}) but coverage improved and gates are green`);
		onProgress(`${batchId}: invocation failed but coverage moved on disk — salvaged as resolved`);

		stop = finish({ outcome: BatchOutcome.Resolved, files: salvaged.files });
	}

	return stop;
};

/**
 * A report of `failed` is a decline, not a run-stopper: that status is exactly
 * what the writer's role rules say to report when a file's source looks
 * defective, which is the routine set-aside case here.
 */
export const getCoverageAttemptStop = async ({
	batchId,
	batch,
	attempt,
	rationale,
	onProgress,
	testsOnly,
	measure,
	gates,
	finish,
}: Params): Promise<CoverageBatchStop | undefined> => {
	if (!attempt.ok) {
		return attempt.rateLimited
			? { kind: CoverageBatchStopKind.Parked }
			: salvage({ batchId, failure: attempt.failure, rationale, onProgress, testsOnly, measure, gates, finish });
	}

	// Cheapest check first, and before any classification: no path records a
	// batch while a source file sits modified in the tree.
	const violation = await testsOnly();
	const { report } = attempt;
	let stop: CoverageBatchStop | undefined;

	if (violation) {
		stop = { kind: CoverageBatchStopKind.Failed, error: violation };
	} else if (report.status === WorkReportStatus.TerminatedScope || report.status === WorkReportStatus.Failed) {
		// Both are judgment the writer is entitled to: the batch is too large to
		// take on, or the source cannot be tested without changing it. Either way
		// the files go to a human, and the run continues.
		const marker = report.status === WorkReportStatus.TerminatedScope ? 'scope' : 'failed';

		rationale.push(...report.failures.map((entry) => `[${marker}] ${entry}`));

		stop = finish({ outcome: BatchOutcome.Declined, files: unmeasured({ batch }) });
	} else if (report.status !== WorkReportStatus.Complete) {
		stop = { kind: CoverageBatchStopKind.Escalated, error: `${batchId}: ${report.status} — ${report.failures.join('; ')}` };
	}

	return stop;
};
