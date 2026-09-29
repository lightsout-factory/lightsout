import { RunStatus } from '@lightsout/engine/contracts';
import type { BadgeVariant } from '#src/common/constants/BadgeVariant.ts';
import { runStatusFamilies } from '#src/common/constants/runStatusFamilies.ts';

/**
 * The variant is read from `runStatusFamilies` rather than restated, so the
 * timeline and the badge cannot disagree about a status's colour.
 */
export const statusBadgeConfig: Record<RunStatus, { label: string; variant: BadgeVariant }> = {
	[RunStatus.Pending]: { label: 'pending', variant: runStatusFamilies[RunStatus.Pending] },
	[RunStatus.Running]: { label: 'running', variant: runStatusFamilies[RunStatus.Running] },
	[RunStatus.Passed]: { label: 'passed', variant: runStatusFamilies[RunStatus.Passed] },
	[RunStatus.Failed]: { label: 'failed', variant: runStatusFamilies[RunStatus.Failed] },
	[RunStatus.PausedRateLimit]: { label: 'paused · rate limit', variant: runStatusFamilies[RunStatus.PausedRateLimit] },
	[RunStatus.PausedBudget]: { label: 'paused · budget', variant: runStatusFamilies[RunStatus.PausedBudget] },
	[RunStatus.Escalated]: { label: 'escalated', variant: runStatusFamilies[RunStatus.Escalated] },
};
