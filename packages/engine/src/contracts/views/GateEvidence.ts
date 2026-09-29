import { z } from 'zod';
import { GateResult } from '#src/contracts/gates/GateResult.ts';

export const GateEvidence = GateResult.extend({
	at: z.string(),
	/** Pipeline step in flight when the command ran; absent on records written outside a step. */
	step: z.string().optional(),
});

export type GateEvidence = z.infer<typeof GateEvidence>;
