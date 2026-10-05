import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { GateRunResult } from '#src/common/types/GateRunResult.ts';
import { BatchOutcome } from '#src/contracts/refactor/BatchOutcome.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import { BatchStopKind } from '#src/refactor/common/constants/BatchStopKind.ts';
import type { BatchStop } from '#src/refactor/common/types/BatchStop.ts';

interface Params {
	batchId: string;
	attempt: AgentOutcome<WorkReport>;
	/** The findings this pass was asked to resolve — what the salvage and scope paths re-check. */
	workFindings: StandardsFinding[];
	/** Batch-level rationale collector: the salvage and scope notes accumulate here. */
	rationale: string[];
	onProgress: (message: string) => void;
	remainingSiteKeys: (params: { frozen: StandardsFinding[] }) => Promise<string[]>;
	/** Run the batch's gates and answer their whole verdict — a red, a crash, or a run that never started. */
	gates: () => Promise<GateRunResult>;
	/** Build the batch's done stop — the caller's shared post-step, which attaches the report and the changed files. */
	finish: (params: { outcome: BatchOutcome; remainingSiteKeys: string[] }) => Promise<BatchStop>;
}

/** Undefined when the pass reported complete and the gates decide next. */
export const getAttemptStop = async ({
	batchId,
	attempt,
	workFindings,
	rationale,
	onProgress,
	remainingSiteKeys,
	gates,
	finish,
}: Params): Promise<BatchStop | undefined> => {
	let stop: BatchStop | undefined;

	if (!attempt.ok) {
		if (attempt.rateLimited) {
			stop = { kind: BatchStopKind.Parked };
		} else if ((await remainingSiteKeys({ frozen: workFindings })).length === 0 && (await gates()).error === undefined) {
			// An agent can die after finishing its edits but before reporting. A gate
			// run that never started is not green: it proves nothing about the work.
			rationale.push(`[other] salvaged: agent invocation failed (${attempt.failure}) but the sites are resolved and gates are green`);
			onProgress(`${batchId}: invocation failed but work verified on disk — salvaged as resolved`);

			stop = await finish({ outcome: BatchOutcome.Resolved, remainingSiteKeys: [] });
		} else {
			stop = { kind: BatchStopKind.Failed, error: `${batchId}: ${attempt.failure}` };
		}
	} else if (attempt.report.status === WorkReportStatus.TerminatedScope) {
		// A scope refusal is judgment, not failure; the human reviews it with the report.
		rationale.push(...attempt.report.failures.map((entry) => `[scope] ${entry}`));

		stop = await finish({ outcome: BatchOutcome.Declined, remainingSiteKeys: await remainingSiteKeys({ frozen: workFindings }) });
	} else if (attempt.report.status !== WorkReportStatus.Complete) {
		stop = {
			kind: attempt.report.status === WorkReportStatus.Failed ? BatchStopKind.Failed : BatchStopKind.Escalated,
			error: `${batchId}: ${attempt.report.status} — ${attempt.report.failures.join('; ')}`,
		};
	}

	return stop;
};
