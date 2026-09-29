import type { RunUsage } from '#src/contracts/run/RunUsage.ts';

interface Params {
	/** The manifest's persisted usage, when resuming — totals survive process boundaries. */
	usage?: RunUsage;
}

export const seedUsageTotals = ({ usage }: Params): RunUsage => ({
	invocations: 0,
	inputTokens: 0,
	outputTokens: 0,
	cacheReadTokens: 0,
	cacheCreationTokens: 0,
	costUsd: 0,
	...usage,
});
