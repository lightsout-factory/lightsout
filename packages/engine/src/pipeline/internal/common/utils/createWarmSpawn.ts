import type { WriterResult } from '#src/pipeline/internal/common/types/WriterResult.ts';

interface Params<TGroup> {
	group: TGroup | undefined;
	spawnWriter: ({ group, onFirstEvent }: { group: TGroup; onFirstEvent?: () => void }) => Promise<WriterResult<TGroup>>;
	aggregate: { collect: ({ result }: { result: WriterResult<TGroup> }) => Promise<void> };
}

interface WarmSpawn<TGroup> {
	warm: Promise<WriterResult<TGroup>> | undefined;
	/** Fold the warm-up result in, once and only once. */
	collectWarm: () => Promise<void>;
	/** Wait until the batch behind the warm-up may spawn. */
	awaitGate: () => Promise<void>;
	isSettled: () => boolean;
}

/**
 * The first assignment goes out alone and the rest wait for its first stream
 * event: once its response begins, the harness's prompt cache holds the
 * writers' shared system prompt, so the batch that follows reads the cache
 * instead of paying for it once per writer. The gate is raced against the
 * spawn settling, so a spawn that dies or streams nothing falls back to
 * unwarmed behavior.
 *
 * @typeParam TGroup - the assignment each writer was given.
 */
export const createWarmSpawn = <TGroup>({ group, spawnWriter, aggregate }: Params<TGroup>): WarmSpawn<TGroup> => {
	let settled = false;
	let collected = false;
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const warm =
		group === undefined
			? undefined
			: spawnWriter({ group, onFirstEvent: release }).finally(() => {
					settled = true;
				});

	// Collected exactly once, wherever it resolves: before the batches when the
	// warm spawn settled first (a rate limit there must stop them), between
	// batches once it settles mid-run, or after the loop on the event path.
	const collectWarm = async () => {
		if (warm && !collected) {
			collected = true;

			await aggregate.collect({ result: await warm });
		}
	};

	const awaitGate = async () => {
		if (warm) {
			await Promise.race([
				gate,
				warm.then(
					() => undefined,
					() => undefined,
				),
			]);
		}
	};

	return { warm, collectWarm, awaitGate, isSettled: () => settled };
};
