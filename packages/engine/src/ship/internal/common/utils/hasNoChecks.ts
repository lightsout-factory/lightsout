import type { ChecksSummary } from '#src/ship/forge/common/types/ChecksSummary.ts';

/**
 * Not the same answer as "every check passed". Shared by `waitForChecks` and `runShipAttempt` so
 * both agree on which verdict a repository with no CI gets.
 */
export const hasNoChecks = ({ summary }: { summary: ChecksSummary }): boolean =>
	summary.failing.length === 0 && summary.pending.length === 0 && summary.passing.length === 0;
