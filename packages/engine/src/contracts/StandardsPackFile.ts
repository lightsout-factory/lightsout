import { z } from 'zod';
import { StandardsRuleSettings } from '#src/contracts/StandardsRuleSettings.ts';

/**
 * One file in a library's `packs/` folder. Every include list adds; the
 * `rule-settings` map is the repo's `standards-rule-settings` shape exactly,
 * so the two can never drift apart. Shape only: whether an entry names
 * something that exists is decided when the pack is resolved, the one place
 * that sees every registered library.
 */
export const StandardsPackFile = z
	.object({
		/** One line a pack page shows under the pack's name. */
		description: z.string().min(1),
		/** Whole packs, single topics and single rules the pack brings in. */
		include: z
			.object({
				/** Pack addresses, `<library>/<file-stem>`; the last listed wins where two disagree about a rule. */
				packs: z.array(z.string()).optional(),
				/** Topic addresses, `<library>/<topic path>`. */
				topics: z.array(z.string()).optional(),
				/** Full rule names, or short ids unique among the libraries the pack names. */
				rules: z.array(z.string()).optional(),
			})
			.strict()
			.optional(),
		/** Severity and options for rules already in the pack, applied after every include. */
		'rule-settings': StandardsRuleSettings.optional(),
		/**
		 * Makes the pack conditional: it brings its rules to a package only when
		 * that package's `package.json` declares one of these dependencies. A pack
		 * without it applies everywhere.
		 */
		'applies-when': z
			.object({
				/** npm package names; declaring any one of them is enough. */
				dependencies: z.array(z.string().min(1)).min(1),
			})
			.strict()
			.optional(),
	})
	.strict();

export type StandardsPackFile = z.infer<typeof StandardsPackFile>;
