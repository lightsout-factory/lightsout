import { z } from 'zod';

/**
 * The pack's `lightsout-standards.json`. Deliberately not `.strict()`: a later
 * format version may add keys, and an unknown key is never worth refusing a pack over.
 */
export const StandardsPackRoot = z.object({
	/** Names the pack in the assembled documents' header lines. */
	name: z.string().min(1),
	formatVersion: z.literal(1),
	/**
	 * Stamped by the bundler on a built pack. Building strips the fixtures, so
	 * without this `lightsout standards-validate` would report every stripped
	 * fixture as a fault instead of one fact about the pack.
	 */
	built: z.literal(true).optional(),
	/** One line a pack page shows under its name. */
	description: z.string().min(1).optional(),
	/** Absolute URL for the pack's own page or repository. */
	homepage: z.url().optional(),
});

export type StandardsPackRoot = z.infer<typeof StandardsPackRoot>;
