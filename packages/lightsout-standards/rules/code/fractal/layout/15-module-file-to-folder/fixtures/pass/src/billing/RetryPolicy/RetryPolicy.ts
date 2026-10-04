import { getDelay } from './getDelay.ts';

// Correct: the module has a file of its own, so it is a folder.
export class RetryPolicy {
	next({ attempt }: { attempt: number }): number {
		return getDelay({ attempt });
	}
}
