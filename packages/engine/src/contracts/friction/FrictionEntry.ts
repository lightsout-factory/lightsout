import { z } from 'zod';
import { FrictionArea } from '#src/contracts/friction/FrictionArea.ts';
import { FrictionKind } from '#src/contracts/friction/internal/FrictionKind.ts';

export const FrictionEntry = z.object({
	/** `friction` (something fought the agent) or `decision` (a silent-input guess). Omitted means friction. */
	kind: z.enum(FrictionKind).optional(),
	/** Best-effort taxonomy: an unknown label coerces to `other` rather than failing the whole report; `detail` carries the real signal. */
	area: z.enum(FrictionArea).catch(FrictionArea.Other),
	detail: z.string(),
});

export type FrictionEntry = z.infer<typeof FrictionEntry>;
