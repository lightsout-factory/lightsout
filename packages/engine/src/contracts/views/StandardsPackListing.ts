import { z } from 'zod';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/** One pack file of a library, resolved: what it says it includes, and what that brings in. */
export const StandardsPackListing = z.object({
	/** The pack file's stem — the address segment after the library, e.g. 'node'. */
	name: z.string(),
	/** `<library>/<name>`, as a config key or another pack file names it. */
	address: z.string(),
	description: z.string().optional(),
	/** Set on a conditional pack only: it reaches a package when that package's `package.json` declares one of these dependencies. */
	appliesWhen: z.object({ dependencies: z.array(z.string()) }).optional(),
	/** The pack file's include lists as written; a list the file leaves out is empty. */
	include: z.object({
		packs: z.array(z.string()),
		topics: z.array(z.string()),
		rules: z.array(z.string()),
	}),
	/** Addresses of the topics the resolved pack brings in, sorted. */
	topics: z.array(z.string()),
	/** Every rule the resolved pack holds, by full name, at the severity and options the pack settles on; sorted by name. */
	rules: z.array(
		z.object({
			name: z.string(),
			severity: z.enum(StandardsSeverity),
			options: z.record(z.string(), z.number()),
		}),
	),
	totals: z.object({
		rules: z.number(),
		deterministic: z.number(),
		agent: z.number(),
		topics: z.number(),
	}),
});

export type StandardsPackListing = z.infer<typeof StandardsPackListing>;
