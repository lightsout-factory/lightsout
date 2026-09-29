import type { AgentOutcome } from '#src/invoke/common/types/AgentOutcome.ts';

interface Params<Report> {
	/** `undefined` for a task `drainTasks` never started. */
	result: { outcome: AgentOutcome<Report> } | undefined;
}

export const isRateLimited = <Report>({ result }: Params<Report>): boolean => result !== undefined && !result.outcome.ok && result.outcome.rateLimited;
