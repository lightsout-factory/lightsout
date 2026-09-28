interface ConstructorParams {
	perMinute: number;
}

// Incorrect: a folder that holds only this one file. Nothing else in it serves
// RateLimiter, so it should be the single file src/RateLimiter.ts.
export class RateLimiter {
	private remaining: number;

	constructor({ perMinute }: ConstructorParams) {
		this.remaining = perMinute;
	}

	take(): boolean {
		const allowed = this.remaining > 0;

		if (allowed) {
			this.remaining -= 1;
		}

		return allowed;
	}
}
