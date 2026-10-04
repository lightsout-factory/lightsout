import { z } from 'zod';
import { FrictionEntry } from '#src/contracts/friction/FrictionEntry/FrictionEntry.ts';

export const FrictionRecord = FrictionEntry.extend({
	at: z.string(),
	runId: z.string(),
	step: z.string(),
});

export type FrictionRecord = z.infer<typeof FrictionRecord>;
