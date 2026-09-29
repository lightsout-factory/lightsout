import type { StepReportKind } from '#src/features/runDetail/internal/common/constants/StepReportKind.ts';

interface BatchStepReport {
	kind: typeof StepReportKind.Batch;
	outcome: string;
	/** Site keys still present after the batch. */
	remaining: number;
	rationale: string[];
	advisories: { rule: string; siteKey: string; outcome: string; reason?: string }[];
}

interface PhaseStepReport {
	kind: typeof StepReportKind.Phase;
	runId: string;
}

interface WritersStepReport {
	kind: typeof StepReportKind.Writers;
	count: number;
	fileCount: number;
	statuses: Record<string, number>;
	summaries: string[];
}

interface WorkStepReport {
	kind: typeof StepReportKind.Work;
	status: string;
	summary: string;
	files: { path: string; summary: string }[];
	failures: string[];
}

interface CleanupStepReport {
	kind: typeof StepReportKind.Cleanup;
	rounds: number;
	/** Undefined while cleanup is still running or parked mid-loop. */
	endReason: string | undefined;
	remaining: number;
	carried: number;
	reviewFindings: number;
	failures: string[];
	/** The last executor's one-line summary, when a round ran. */
	summary: string | undefined;
}

interface RawStepReport {
	kind: typeof StepReportKind.Raw;
	text: string;
}

/** The member shapes stay unexported: a consumer narrows on `kind` rather than naming one. */
export type StepReport = BatchStepReport | PhaseStepReport | WritersStepReport | WorkStepReport | CleanupStepReport | RawStepReport;
