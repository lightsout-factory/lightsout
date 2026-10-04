import { RunStatus } from '#src/contracts/run/RunStatus.ts';

/** Keyed by `RunStatus` rather than `string`, so a new status fails the typecheck here instead of printing as `?`. */
export const statusIcons: Record<RunStatus, string> = {
	[RunStatus.Passed]: '✓',
	[RunStatus.Failed]: '✗',
	[RunStatus.Running]: '…',
	[RunStatus.Pending]: '○',
	[RunStatus.PausedRateLimit]: '⏸',
	// stopped and resumable, exactly like the rate-limit pause
	[RunStatus.PausedBudget]: '⏸',
	[RunStatus.Escalated]: '⚑',
};
