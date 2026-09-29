export const StepReportKind = {
	Batch: 'batch',
	Phase: 'phase',
	Writers: 'writers',
	Work: 'work',
	Cleanup: 'cleanup',
	Raw: 'raw',
} as const;

export type StepReportKind = (typeof StepReportKind)[keyof typeof StepReportKind];
