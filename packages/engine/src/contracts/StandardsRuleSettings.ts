import { z } from 'zod';
// No cycle — nothing under `contracts/standardsCheck/` reads the config.
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/**
 * Keyed by rule id. The ids come from the loaded standards packs, so a mistyped
 * one cannot be caught while parsing: `resolvePackageRuleStates` refuses a key
 * naming no loaded rule and lists the valid ids.
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
