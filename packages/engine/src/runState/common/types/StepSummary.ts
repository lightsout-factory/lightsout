import type { RunStatus } from '#src/contracts/run/RunStatus.ts';

export interface StepSummary {
	id: string;
	status: RunStatus;
	attempts: number;
	durationMs: number | undefined;
	changedFiles: string[] | undefined;
	invocations: number;
	outputTokens: number;
	costUsd: number;
}
