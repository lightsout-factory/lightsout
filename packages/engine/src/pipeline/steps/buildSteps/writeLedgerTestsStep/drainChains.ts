import { testWriterConcurrency } from '#src/pipeline/steps/common/constants/testWriterConcurrency.ts';
import type { WriterResult } from '#src/pipeline/steps/common/types/WriterResult.ts';

interface Params<TGroup> {
	/** One thunk per serial chain of writer chunks. */
	chains: Array<() => Promise<WriterResult<TGroup>[]>>;
	/** Where every result lands, and the park flag that stops new work. */
	aggregate: { collect: (params: { result: WriterResult<TGroup> }) => Promise<void>; isParked: () => boolean };
	/** Fold the warm-up spawn in, once it has settled. */
	collectWarm: () => Promise<void>;
	isSettled: () => boolean;
}

/**
 * Slots refill the moment one frees rather than draining in lockstep, because
 * writer durations are wildly uneven and a lockstep batch idles every slot
 * until its slowest member returns.
 *
 * @typeParam TGroup - the assignment each writer was given; the caller's chains decide it.
 */
export const drainChains = async <TGroup>({ chains, aggregate, collectWarm, isSettled }: Params<TGroup>): Promise<void> => {
	let next = 0;

	const runSlot = async (): Promise<void> => {
		while (next < chains.length && !aggregate.isParked()) {
			const chain = chains[next];

			next += 1;

			if (chain === undefined) {
				return;
			}

			const results = await chain();

			if (isSettled()) {
				await collectWarm();
			}

			for (const result of results) {
				await aggregate.collect({ result });
			}
		}
	};

	await Promise.all(Array.from({ length: Math.min(testWriterConcurrency, chains.length) }, () => runSlot()));
};
