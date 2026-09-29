import { z } from 'zod';

/**
 * Keyed by the model identifier a harness was invoked with, and read only by
 * `lightsout report`'s estimated-cost column. Nothing computed from it is
 * stored, so a saved record stays a statement of what a harness reported. There
 * is no default, because a rate nobody stated cannot be guessed at.
 *
 * Rates are US dollars per million tokens, the unit vendors publish. Each entry
 * is `.strict()` so a typo in a rate name fails loudly rather than leaving a
 * token count silently unpriced.
 */
export const ConfigPricing = z.record(
	z.string(),
	z
		.object({
			/** US dollars per million input tokens. */
			input: z.number().nonnegative(),
			/** US dollars per million output tokens. */
			output: z.number().nonnegative(),
			/** US dollars per million tokens read from the prompt cache. */
			'cache-read': z.number().nonnegative(),
			/** US dollars per million tokens written to the prompt cache. */
			'cache-write': z.number().nonnegative(),
		})
		.strict(),
);

export type ConfigPricing = z.infer<typeof ConfigPricing>;
