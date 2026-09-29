import { testWriterConcurrency } from '#src/pipeline/internal/common/constants/testWriterConcurrency.ts';
import type { TestTargetGroup } from '#src/pipeline/internal/common/types/TestTargetGroup.ts';
import type { WriterResult } from '#src/pipeline/internal/common/types/WriterResult.ts';

interface Params {
	groups: TestTargetGroup[];
	spawnWriter: ({ group }: { group: TestTargetGroup }) => Promise<WriterResult>;
	aggregate: { collect: (params: { result: WriterResult }) => Promise<void>; isParked: () => boolean };
	warm: { spawn: Promise<WriterResult>; group: TestTargetGroup } | undefined;
	collectWarm: () => Promise<void>;
}

// The subject files writers currently hold. Two writers must never hold one
// file: they would edit the same test on disk.
const createSubjectReservations = () => {
	const held = new Set<string>();

	return {
		isFree: ({ group }: { group: TestTargetGroup }) => group.subjects.every((subject) => !held.has(subject)),
		reserve: ({ group }: { group: TestTargetGroup }) => {
			for (const subject of group.subjects) {
				held.add(subject);
			}
		},
		release: ({ group }: { group: TestTargetGroup }) => {
			for (const subject of group.subjects) {
				held.delete(subject);
			}
		},
	};
};

const takeEligible = ({ waiting, reservations }: { waiting: TestTargetGroup[]; reservations: ReturnType<typeof createSubjectReservations> }) => {
	const group = waiting.find((candidate) => reservations.isFree({ group: candidate }));

	if (group) {
		waiting.splice(waiting.indexOf(group), 1);
	}

	return group;
};

/**
 * Subject collision is the only exclusion that matters, so an assignment
 * blocked on a held file is passed over rather than left holding a slot. On
 * every settle the reservation is released and the result folded in before the
 * next scan: the park flag is set while folding in, so scanning first would
 * launch one more writer past a rate limit the run already hit. Every
 * reservation is held by a running writer, so the drain cannot deadlock.
 *
 * @param groups - the assignments the warm-up writer did not claim, in the fan-out's queue order
 */
export const drainBySubjects = async ({ groups, spawnWriter, aggregate, warm, collectWarm }: Params): Promise<void> => {
	const reservations = createSubjectReservations();
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

	const startEligible = () => {
		while (!aggregate.isParked() && running.size < testWriterConcurrency) {
			const group = takeEligible({ waiting, reservations });

			if (group === undefined) {
				break;
			}

			reservations.reserve({ group });
			track({
				settle: async () => {
					const result = await spawnWriter({ group }).finally(() => {
						reservations.release({ group });
					});

					await aggregate.collect({ result });
				},
			});
		}
	};

	if (warm) {
		reservations.reserve({ group: warm.group });
		track({
			settle: async () => {
				await warm.spawn.finally(() => {
					reservations.release({ group: warm.group });
				});

				await collectWarm();
			},
		});
	}

	startEligible();

	while (running.size > 0) {
		await Promise.race([...running.values()]);

		startEligible();
	}

	if (failure) {
		throw failure.error;
	}
};
