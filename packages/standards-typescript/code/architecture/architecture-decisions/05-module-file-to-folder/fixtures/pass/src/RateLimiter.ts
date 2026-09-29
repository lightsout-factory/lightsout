interface ConstructorParams {
	perMinute: number;
}

// Correct: one file. Nothing but the class is exported, so TypeScript keeps
// everything else in the file private.
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
