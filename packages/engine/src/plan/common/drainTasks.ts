interface Params<Result> {
	tasks: Array<() => Promise<Result>>;
	concurrency: number;
	shouldStop?: (params: { results: Array<Result | undefined> }) => boolean;
}

/**
 * Slots refill the moment one frees rather than running in lockstep batches:
 * agent durations are wildly uneven, and waiting for a whole batch leaves every
 * other slot idle until its slowest member returns.
 *
 * Results are returned by task index, not completion order. `shouldStop` stops
 * only *new starts*; everything running is awaited. Tasks never started resolve
 * to `undefined`, which lets a caller tell "checked and clean" from "never ran".
 */
export const drainTasks = async <Result>({ tasks, concurrency, shouldStop }: Params<Result>): Promise<Array<Result | undefined>> => {
	const results: Array<Result | undefined> = tasks.map(() => undefined);
	let next = 0;

	const runSlot = async () => {
		while (next < tasks.length && shouldStop?.({ results }) !== true) {
			const index = next;
			const task = tasks[index];

			next += 1;

			if (task) {
				results[index] = await task();
			}
		}
	};

	await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => runSlot()));

	return results;
};
