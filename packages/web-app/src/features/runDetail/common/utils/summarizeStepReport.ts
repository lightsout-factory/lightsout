import { BatchReport, PhaseReport, RefactorStepReport, WorkReport, WritersReport } from '@lightsout/engine/contracts';
import { StepReportKind } from '#src/features/runDetail/internal/common/constants/StepReportKind.ts';
import type { StepReport } from '#src/features/runDetail/internal/common/types/StepReport.ts';

const summarizeWriters = ({ reports }: { reports: WorkReport[] }) => {
	const statuses: Record<string, number> = {};
	let fileCount = 0;

	for (const report of reports) {
		statuses[report.status] = (statuses[report.status] ?? 0) + 1;
		fileCount += report.changedFiles.length;
	}

	const summary: StepReport = {
		kind: StepReportKind.Writers,
		count: reports.length,
		fileCount,
		statuses,
		summaries: reports.map((report) => report.summary),
	};

	return summary;
};

interface Params {
	/** The step's `report` field, exactly as the manifest stores it. */
	report: unknown;
}

/**
 * Reads the report by shape because `StepRecord.report` is `z.unknown()`: the
 * manifest stores it opaquely. Anything unrecognised degrades to JSON rather than
 * taking the page down.
 */
export const summarizeStepReport = ({ report }: Params): StepReport | undefined => {
	if (report === undefined) {
		return undefined;
	}

	// Tried first, and deliberately: a cleanup record nests a whole `WorkReport`
	// of its own, so any later candidate would read it as the wrong kind of step.
	const cleanup = RefactorStepReport.safeParse(report);
	const batch = BatchReport.safeParse(report);
	const phase = PhaseReport.safeParse(report);
	const writers = WritersReport.safeParse(report);
	const work = WorkReport.safeParse(report);
	let summary: StepReport;

	if (cleanup.success) {
		const { roundsUsed, endReason, remaining, inherited, uncertain, finalReview, failures, lastReport } = cleanup.data;

		summary = {
			kind: StepReportKind.Cleanup,
			rounds: roundsUsed,
			endReason,
			remaining: remaining.length,
			carried: inherited.length + uncertain.length,
			reviewFindings: finalReview.length,
			failures,
			summary: lastReport?.summary,
		};
	} else if (batch.success) {
		summary = {
			kind: StepReportKind.Batch,
			outcome: batch.data.outcome,
			remaining: batch.data.remainingSiteKeys.length,
			rationale: batch.data.rationale,
			advisories: batch.data.advisoryOutcomes ?? [],
		};
	} else if (phase.success) {
		summary = { kind: StepReportKind.Phase, runId: phase.data.runId };
	} else if (writers.success) {
		summary = summarizeWriters({ reports: writers.data.reports });
	} else if (work.success) {
		summary = {
			kind: StepReportKind.Work,
			status: work.data.status,
			summary: work.data.summary,
			files: work.data.changedFiles,
			failures: work.data.failures,
		};
	} else {
		// Cut rather than paginated: past a few thousand characters this is a file
		// to open, not a panel to read.
		summary = { kind: StepReportKind.Raw, text: JSON.stringify(report, null, 2).slice(0, 4_000) };
	}

	return summary;
};
