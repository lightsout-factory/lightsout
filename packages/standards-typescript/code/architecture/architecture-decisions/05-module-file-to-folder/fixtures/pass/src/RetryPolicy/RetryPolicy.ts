import type { RetryPolicyOptions } from './common/types/RetryPolicyOptions.ts';

// Correct: RetryPolicy exports its options type for callers, so it needs a
// second file. It is a folder that holds the class and that file.
export class RetryPolicy {
	private readonly options: RetryPolicyOptions;

	constructor(options: RetryPolicyOptions) {
		this.options = options;
	}

	delayFor({ attempt }: { attempt: number }): number | undefined {
		return attempt < this.options.attempts ? this.options.delayMs * 2 ** attempt : undefined;
	}
}
