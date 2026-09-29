import { z } from 'zod';
// No cycle — nothing under `contracts/standardsCheck/` reads the config.
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/**
 * Per-rule overrides for `lightsout standards-check` (the `standards-checks` block), keyed by rule id. A
 * value is either a severity, or an object with a severity and/or that
 * rule's own settings. A rule not named here keeps its default — silence
 * is never a change.
 *
 * The ids come from the loaded standards packages, so a mistyped one cannot
 * be caught while parsing this file: `resolvePackageRuleStates` refuses a
 * key naming no loaded rule and lists the valid ids. The protection is the
 * same, it just happens where the answer exists. Read the live state with
 * `lightsout standards-check --list`.
 */
export const StandardsCheckOverrides = z.record(
	z.string(),
	z.union([
		z.enum(StandardsSeverity),
		z
			.object({
				severity: z.enum(StandardsSeverity).optional(),
				settings: z.record(z.string(), z.number()).optional(),
			})
			.strict(),
	]),
);

export type StandardsCheckOverrides = z.infer<typeof StandardsCheckOverrides>;
