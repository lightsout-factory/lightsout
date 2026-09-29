import type { GateResult } from '#src/contracts/gates/GateResult.ts';
import type { SelfCheckReason } from '#src/gates/common/constants/SelfCheckReason.ts';

export interface SelfCheckResult {
	reason: SelfCheckReason;
	gateNames: string[];
	gates: GateResult[];
	error: string | undefined;
	crashes: string[];
	/** One line per gate that ran past its ceiling on every attempt. Filled only on a `SelfCheckReason.Ran` ending, and empty on every other ending. */
	timeouts: string[];
	/**
	 * Set only with `SelfCheckReason.Coordination`. Required-but-possibly-undefined
	 * rather than optional, as on `GateRunResult`, so the compiler finds every
	 * literal that builds one of these.
	 */
	coordination: string | undefined;
}
