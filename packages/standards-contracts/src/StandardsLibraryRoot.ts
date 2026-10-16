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
	/**
	 * Globs, from each fixture tree's root, of the code files the library's
	 * fixtures hold, their tests included — the `source-files` a fixture tree
	 * would declare if it were a repo. Absent, no fixture file is code.
	 */
	fixtureSourceFiles: z.array(z.string().min(1)).min(1).optional(),
	/**
	 * Globs, from each fixture tree's root, of the test files the library's
	 * fixtures hold. A fixture tree is a miniature repo with no config of its
	 * own, so this is how the engine tells its tests from its source when it
	 * validates a rule against its fixtures. Absent, no fixture file is a test.
	 */
	fixtureTestFiles: z.array(z.string().min(1)).min(1).optional(),
	/** One line a pack page shows under its name. */
	description: z.string().min(1).optional(),
	/** Absolute URL for the pack's own page or repository. */
	homepage: z.url().optional(),
});

export type StandardsLibraryRoot = z.infer<typeof StandardsLibraryRoot>;
