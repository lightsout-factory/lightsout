import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { AgentOutcome } from '#src/invoke/common/types/AgentOutcome.ts';

interface Params {
	outcome: AgentOutcome<unknown>;
}

/** A rate-limited call is deliberately not a failure: the wall is a resumable state. */
export const getAgentOutcomeStatus = ({ outcome }: Params): RunStatus =>
	outcome.ok ? RunStatus.Passed : outcome.rateLimited ? RunStatus.PausedRateLimit : RunStatus.Failed;
