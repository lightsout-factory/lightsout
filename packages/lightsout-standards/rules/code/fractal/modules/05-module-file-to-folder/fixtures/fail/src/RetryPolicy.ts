import type { RetryPolicyOptions } from './common/types/RetryPolicyOptions.ts';

// Incorrect: RetryPolicy exports its options type for callers, and a file holds
// one export, so it needs a second file. It should be a folder, not one file.
export class RetryPolicy {
	private readonly options: RetryPolicyOptions;

	constructor(options: RetryPolicyOptions) {
		this.options = options;
	}

	delayFor({ attempt }: { attempt: number }): number | undefined {
		return attempt < this.options.attempts ? this.options.delayMs * 2 ** attempt : undefined;
	}
}
