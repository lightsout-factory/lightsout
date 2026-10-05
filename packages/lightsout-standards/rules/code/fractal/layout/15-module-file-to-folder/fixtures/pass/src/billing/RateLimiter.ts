// Correct: a module with no files of its own is one file.
export class RateLimiter {
	isAllowed({ count }: { count: number }): boolean {
		return count < 10;
	}
}
