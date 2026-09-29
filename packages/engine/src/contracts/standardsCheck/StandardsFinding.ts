import { RawStandardsFinding } from '@lightsout/standards-contracts';
import { z } from 'zod';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/**
 * Spread rather than `.extend()` so `rule` and `severity` stay first: Zod returns
 * parsed keys in declaration order, and these findings are written to a file
 * people read.
 */
export const StandardsFinding = z.object({
	/** A free string: the valid ids are known only where the loaded packages have been read. */
	rule: z.string(),
	/** `off` is a configuration state: a rule switched off emits nothing. */
	severity: z.enum([StandardsSeverity.Blocking, StandardsSeverity.Advisory]),
	...RawStandardsFinding.shape,
});

export type StandardsFinding = z.infer<typeof StandardsFinding>;
