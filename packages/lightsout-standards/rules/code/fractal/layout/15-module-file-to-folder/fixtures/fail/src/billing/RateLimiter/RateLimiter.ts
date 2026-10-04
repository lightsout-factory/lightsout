// Incorrect: the folder holds nothing but its main file. It belongs at
// src/billing/RateLimiter.ts.
export class RateLimiter {
	isAllowed({ count }: { count: number }): boolean {
		return count < 10;
	}
}
