import type { CommandResult } from '#src/common/types/CommandResult.ts';
import type { GateEnding } from '#src/gates/internal/common/constants/GateEnding.ts';

/**
 * `ending` is decided by the runner, the only place that saw every attempt: the
 * last attempt's output alone cannot tell an absorbed crash from an unabsorbed
 * one, nor a timeout from a failed spawn.
 */
export interface GateOutcome extends CommandResult {
	ending: GateEnding;
	ceilingMinutes: number;
}
