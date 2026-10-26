import { testWriterConcurrency } from '#src/pipeline/steps/common/constants/testWriterConcurrency.ts';
import type { TestTargetGroup } from '#src/pipeline/steps/common/types/TestTargetGroup.ts';
import type { WriterResult } from '#src/pipeline/steps/common/types/WriterResult.ts';

interface Params {
	groups: TestTargetGroup[];
	spawnWriter: ({ group }: { group: TestTargetGroup }) => Promise<WriterResult>;
	aggregate: { collect: (params: { result: WriterResult }) => Promise<void>; isParked: () => boolean };
	warm: { spawn: Promise<WriterResult>; group: TestTargetGroup } | undefined;
	collectWarm: () => Promise<void>;
}

/**
 * Groups never share a file, so the only limit is the writer ceiling: a freed
 * slot takes the next group in queue order. On every settle the result is
 * folded in before the next launch: the park flag is set while folding in, so
 * launching first would start one more writer past a rate limit the run
 * already hit.
 *
 * @param groups - the assignments the warm-up writer did not claim, in the fan-out's queue order
 */
export const drainWriterGroups = async ({ groups, spawnWriter, aggregate, warm, collectWarm }: Params): Promise<void> => {
	const waiting = [...groups];
	const running = new Map<number, Promise<void>>();
	let nextTicket = 0;
	let failure: { error: unknown } | undefined;

	// A writer's error is held until every writer beside it has settled: the
	// step must never return while a harness process is still live.
	const track = ({ settle }: { settle: () => Promise<void> }) => {
		const ticket = nextTicket;

		nextTicket += 1;
		running.set(
			ticket,
			(async () => {
				try {
					await settle();
				} catch (error) {
					failure = failure ?? { error };
				} finally {
					running.delete(ticket);
				}
			})(),
		);
	};

	const startNext = () => {
		while (!aggregate.isParked() && running.size < testWriterConcurrency) {
			const group = waiting.shift();

			if (group === undefined) {
				break;
			}

			track({
				settle: async () => {
					await aggregate.collect({ result: await spawnWriter({ group }) });
				},
			});
		}
	};

	if (warm) {
		track({
			settle: async () => {
				await warm.spawn;
				await collectWarm();
			},
		});
	}

	startNext();

	while (running.size > 0) {
		await Promise.race([...running.values()]);

		startNext();
	}

	if (failure) {
		throw failure.error;
	}
};
