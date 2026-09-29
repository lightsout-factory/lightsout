import { RunStatus } from '@lightsout/engine/contracts';
import { BadgeVariant } from '#src/common/constants/BadgeVariant.ts';

/**
 * Both paused states share one family: what matters to a reader is "stopped,
 * resumable", and the label still says which wall it hit.
 */
export const runStatusFamilies: Record<RunStatus, BadgeVariant> = {
	[RunStatus.Pending]: BadgeVariant.Neutral,
	[RunStatus.Running]: BadgeVariant.Running,
	[RunStatus.Passed]: BadgeVariant.Passed,
	[RunStatus.Failed]: BadgeVariant.Failed,
	[RunStatus.PausedRateLimit]: BadgeVariant.Paused,
	[RunStatus.PausedBudget]: BadgeVariant.Paused,
	[RunStatus.Escalated]: BadgeVariant.Escalated,
};
