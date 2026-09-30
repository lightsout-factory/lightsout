import { z } from 'zod';
// No cycle — nothing under `contracts/standardsCheck/` reads the config.
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/**
 * Keyed by rule name — a full `<library>/<rule-id>` name, or a short id where it
 * is unique. The names come from the selected pack, so a mistyped one cannot be
 * caught while parsing: `resolveStandardsGroups` refuses a key naming no rule in
 * the pack.
 */
export const StandardsRuleSettings = z.record(
	z.string(),
	z.union([
		z.enum(StandardsSeverity),
		z
			.object({
				severity: z.enum(StandardsSeverity).optional(),
				options: z.record(z.string(), z.number()).optional(),
			})
			.strict(),
	]),
);

export type StandardsRuleSettings = z.infer<typeof StandardsRuleSettings>;
