import { z } from 'zod';

/**
 * The pack's `lightsout-standards.json`. Deliberately not `.strict()`: a later
 * format version may add keys, and an unknown key is never worth refusing a pack over.
 */
export const StandardsLibraryRoot = z.object({
	/**
	 * Names the library in the assembled documents' header lines, and is the
	 * first half of every full rule name `<library>/<rule-id>` — so it may not
	 * hold the slash that separates the two.
	 */
	name: z
		.string()
		.min(1)
		.refine((name) => !name.includes('/'), { message: 'must not hold "/" — the library name is the first half of every full rule name <library>/<rule-id>' }),
	/** Names the layout: version 2 keeps every topic under the library's rules/code/ and rules/tests/ folders. */
	formatVersion: z.literal(2),
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

export type StandardsLibraryRoot = z.infer<typeof StandardsLibraryRoot>;
