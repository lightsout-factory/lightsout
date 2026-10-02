// Incorrect: this type exists for RetryPolicy, but it sits in the shared code
// every module can reach. It belongs in a RetryPolicy/ folder.
export interface RetryPolicyOptions {
	attempts: number;
	delayMs: number;
}
