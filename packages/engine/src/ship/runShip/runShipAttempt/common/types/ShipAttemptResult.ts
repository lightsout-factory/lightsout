import type { ShipResult } from '#src/contracts/ship/ShipResult.ts';

export interface ShipAttemptResult {
	result: ShipResult;
	/** True only for a confirmed stale-base refusal or readable failed-CI evidence awaiting the next scoped repair. A shipped result is never retryable. */
	retryable: boolean;
	/** The failing run's own output, when the next attempt is meant to repair a demonstrated CI defect. */
	ciEvidence?: string;
}
