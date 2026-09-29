import type { Issue } from '@linear/sdk';
import { collectNodes } from '#src/ticketTracker/linear/internal/common/utils/collectNodes.ts';
import { isFinishedState } from '#src/ticketTracker/linear/internal/common/utils/isFinishedState.ts';

interface Params {
	issue: Issue;
}

/**
 * Linear stores "A blocks B" once, on A, so B's blockers are the source side of
 * its inverse 'blocks' relations.
 */
export const getUnfinishedBlockers = async ({ issue }: Params): Promise<string[]> => {
	const relations = await collectNodes({ connection: await issue.inverseRelations() });
	const resolved = await Promise.all(
		relations
			.filter((relation) => relation.type === 'blocks')
			.map(async (relation) => {
				const blocker = await relation.issue;

				if (blocker === undefined) {
					return undefined;
				}

				const state = await blocker.state;

				return isFinishedState({ stateType: state?.type }) ? undefined : blocker.identifier;
			}),
	);

	return resolved.filter((identifier) => identifier !== undefined);
};
