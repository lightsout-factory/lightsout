import { z } from 'zod';

/**
 * No rule id or severity: the engine supplies both, and a check that could name
 * them could name them wrong.
 *
 * The engine's `StandardsFinding` is derived from this by adding those fields,
 * not the other way round, so a pack never depends on the engine's storage format.
 */
export const RawStandardsFinding = z.object({
	/** Grouping key — findings sharing a site key are one remediation unit, and it is the identity the debt ledger records. */
	siteKey: z.string(),
	files: z.array(
		z.object({
			path: z.string(),
			startLine: z.number().optional(),
			endLine: z.number().optional(),
		}),
	),
	/** What is true of this one site — the measurement, the names, the span. */
	detail: z.string(),
	/**
	 * What to do about findings of this kind. Constant across every finding a
	 * rule emits for the same reason, so a reader is told once rather than per site.
	 */
	guidance: z.string().optional(),
	/**
	 * The number a capped rule compared against its cap, so a later read can tell
	 * a site that grew from one that merely moved; `detail` is free to be reworded.
	 */
	measure: z.number().optional(),
});

export type RawStandardsFinding = z.infer<typeof RawStandardsFinding>;
