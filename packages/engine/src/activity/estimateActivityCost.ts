import { gatherNodeProcesses } from '#src/activity/internal/common/utils/gatherNodeProcesses.ts';
import type { ActivityNode } from '#src/contracts/activity/ActivityNode.ts';
import type { ConfigPricing } from '#src/contracts/ConfigPricing.ts';

interface Params {
	/** The level whose whole subtree is priced — its own harness process records and every descendant's. */
	node: ActivityNode;
	pricing?: ConfigPricing;
}

const pricedCounts = [
	{ count: 'inputTokens', rate: 'input' },
	{ count: 'outputTokens', rate: 'output' },
	{ count: 'cacheReadTokens', rate: 'cache-read' },
	{ count: 'cacheCreationTokens', rate: 'cache-write' },
] as const;

/**
 * Answers `undefined`, never `0`, when nothing in the subtree can be priced: a
 * missing rate read as free would price a process killed at its ceiling as
 * having spent nothing.
 */
export const estimateActivityCost = ({ node, pricing }: Params): number | undefined => {
	const tokensPerRate = 1_000_000;
	let priced = 0;
	let dollars = 0;

	for (const process of gatherNodeProcesses({ nodes: [node] })) {
		const rates = process.model === undefined ? undefined : pricing?.[process.model];

		if (rates === undefined) {
			continue;
		}

		for (const field of pricedCounts) {
			const tokens = process.usage?.[field.count];

			if (tokens !== undefined) {
				priced += 1;
				dollars += (tokens / tokensPerRate) * rates[field.rate];
			}
		}
	}

	return priced === 0 ? undefined : dollars;
};
