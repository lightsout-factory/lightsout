import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';

interface Params {
	outcome: AgentOutcome<unknown>;
}

/** A rate-limited call is deliberately not a failure: the wall is a resumable state. */
export const getAgentOutcomeStatus = ({ outcome }: Params): RunStatus =>
	outcome.ok ? RunStatus.Passed : outcome.rateLimited ? RunStatus.PausedRateLimit : RunStatus.Failed;
