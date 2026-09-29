import { z } from 'zod';

/** Drivers that report nothing omit it: the engine records what it can prove and never estimates. */
export const AgentUsage = z.object({
	inputTokens: z.number(),
	outputTokens: z.number(),
	cacheReadTokens: z.number(),
	cacheCreationTokens: z.number(),
	costUsd: z.number(),
});

export type AgentUsage = z.infer<typeof AgentUsage>;
