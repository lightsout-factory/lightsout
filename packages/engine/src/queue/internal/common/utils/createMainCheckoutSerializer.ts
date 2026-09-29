/**
 * Builds, merges and reconciliations all mutate the main checkout's worktrees
 * concurrently, so every such git mutation goes through this one chain.
 *
 * The tail catches, so one failed task cannot poison the chain for whatever is
 * queued behind it.
 */
export const createMainCheckoutSerializer = (): (<Result>(params: { task: () => Promise<Result> }) => Promise<Result>) => {
	let tail: Promise<unknown> = Promise.resolve();

	return <Result>({ task }: { task: () => Promise<Result> }): Promise<Result> => {
		const next = tail.then(task, task);

		tail = next.catch(() => undefined);

		return next;
	};
};
