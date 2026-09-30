// Correct: this type exists for RetryPolicy, so it lives in RetryPolicy's own
// common/types/ folder. Callers still import it from this file.
export interface RetryPolicyOptions {
	attempts: number;
	delayMs: number;
}
