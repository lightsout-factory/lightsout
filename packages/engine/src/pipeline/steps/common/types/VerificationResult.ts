import type { GateRunResult } from '#src/common/types/GateRunResult.ts';
import type { GateResult } from '#src/contracts/gates/GateResult.ts';

/**
 * Declared here rather than derived from `runVerificationGates`' return type: a
 * shape read back out of a `ReturnType` is owned by nobody, so a change in one
 * module silently reshapes a type declared in the other.
 */
export interface VerificationResult extends GateRunResult {
	/** The red gates the step shows and the fix role reads — a crashed or timed-out gate is deliberately absent. */
	failures: GateResult[];
	/**
	 * Every gate this checkpoint observed, which the acceptance check and the
	 * clean-slate probe read their evidence back from. Absent on a verdict
	 * reached before the gates ran at all — a refused test-change review — because
	 * a checkpoint that spent no gate observed none.
	 */
	gates?: GateResult[];
}
