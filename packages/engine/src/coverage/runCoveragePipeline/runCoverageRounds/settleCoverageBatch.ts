import { maxConsecutiveDeclines } from '#src/common/constants/maxConsecutiveDeclines.ts';
import { formatResumeCommand } from '#src/common/formatResumeCommand.ts';
import { CoverageBatchReport } from '#src/contracts/coverage/CoverageBatchReport.ts';
import { BatchOutcome } from '#src/contracts/refactor/BatchOutcome.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { CoverageResult } from '#src/coverage/CoverageResult.ts';
import { CoverageBatchStopKind } from '#src/coverage/common/constants/CoverageBatchStopKind.ts';
import type { CoverageBatch } from '#src/coverage/common/types/CoverageBatch.ts';
import type { CoverageBatchStop } from '#src/coverage/common/types/CoverageBatchStop.ts';
import type { CoverageRun } from '#src/coverage/runCoveragePipeline/common/CoverageRun.ts';
import { maxFileStrikes } from '#src/coverage/runCoveragePipeline/common/constants/maxFileStrikes.ts';
import { updateFileStrikes } from '#src/coverage/runCoveragePipeline/common/updateFileStrikes.ts';

interface Params {
	run: CoverageRun;
	batch: CoverageBatch;
	record: StepRecord;
	outcome: CoverageBatchStop;
	/** Consecutive declines up to and excluding this batch. */
	declineStreak: number;
	/** Per-file no-improvement strikes across the run's resolved batches (path → count). */
	fileStrikes: Map<string, number>;
}

interface CoverageSettlement {
	/** Present when this batch ends the whole run — park, failure, escalation. */
	result?: CoverageResult;
	declineStreak: number;
}

export const settleCoverageBatch = async ({ run, batch, record, outcome, declineStreak, fileStrikes }: Params): Promise<CoverageSettlement> => {
	if (outcome.kind === CoverageBatchStopKind.Parked) {
		const resume = formatResumeCommand({ pipeline: PipelineKind.Coverage, runId: run.current().runId });
		const error = `run parked: harness rate limited or overloaded — resume with \`${resume}\` when the window resets.`;

		return { result: await run.stop({ record, status: RunStatus.PausedRateLimit, error }), declineStreak };
	}

	if (outcome.kind === CoverageBatchStopKind.Failed || outcome.kind === CoverageBatchStopKind.Escalated) {
		const status = outcome.kind === CoverageBatchStopKind.Failed ? RunStatus.Failed : RunStatus.Escalated;

		return { result: await run.stop({ record, status, error: outcome.error }), declineStreak };
	}

	const report = CoverageBatchReport.parse(outcome.report);

	await run.setStep({
		record: { ...record, status: RunStatus.Passed, report, changedFiles: outcome.changedFiles },
		patch: { changedFiles: [...new Set([...run.current().changedFiles, ...outcome.changedFiles])] },
	});

	const settlement: CoverageSettlement = { declineStreak: 0 };

	if (report.outcome !== BatchOutcome.Declined) {
		const struck = updateFileStrikes({ batchId: batch.id, files: report.files, fileStrikes });

		run.setAside.push(...struck);

		for (const path of struck.flatMap((entry) => entry.files)) {
			run.progress(`${path}: set aside after ${maxFileStrikes} batches without improvement`);
		}

		run.progress(`${batch.id}: resolved`);
	} else {
		const streak = declineStreak + 1;

		settlement.declineStreak = streak;

		run.setAside.push({ batchId: batch.id, files: report.files.map((file) => file.path), rationale: report.rationale });
		run.progress(`${batch.id}: declined (${report.files.length} file(s) set aside)`);

		if (streak >= maxConsecutiveDeclines) {
			// The batch's Passed record is already written — only the RUN escalates,
			// so resume never re-spends on it.
			const error = `${maxConsecutiveDeclines} consecutive batches declined — likely systemic (standards injection, gate config, or untestable source), not worth further agent spend.`;

			await run.update({ patch: { status: RunStatus.Escalated, currentStep: null } });
			run.progress(`coverage run stopped after ${batch.id} — ${RunStatus.Escalated}`);
			settlement.result = run.buildHaltedResult({ error });
		}
	}

	return settlement;
};
