import { z } from 'zod';

export const ExploreArea = z.object({
	area: z.string(),
	/** Packages the area touches (repo-relative dirs — used to scope script checks). */
	affectedPackages: z.array(z.string()).default([]),
	filesToModify: z
		.array(
			z.object({
				path: z.string(),
				/** One line — what this file's role is in the change. */
				role: z.string(),
			}),
		)
		.default([]),
	patternsToMirror: z
		.array(
			z.object({
				path: z.string(),
				/** What to take from this file when writing the analogous code. */
				takeaway: z.string(),
			}),
		)
		.default([]),
	integrationPoints: z
		.array(
			z.object({
				name: z.string(),
				/** The real signature the new code integrates against. */
				signature: z.string(),
				/** Where it lives, file:line. */
				at: z.string(),
			}),
		)
		.default([]),
	scripts: z
		.array(
			z.object({
				/** package.json script key (e.g. 'check', 'test-unit'). */
				key: z.string(),
				command: z.string(),
			}),
		)
		.default([]),
	/** One line — the naming convention the area follows. */
	namingConvention: z.string(),
});

export type ExploreArea = z.infer<typeof ExploreArea>;
