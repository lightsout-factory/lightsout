import { z } from 'zod';

/** An object rather than a bare string so the file can grow a field without breaking every reader. */
export const RelayAnswer = z.object({
	answer: z.string(),
});

export type RelayAnswer = z.infer<typeof RelayAnswer>;
