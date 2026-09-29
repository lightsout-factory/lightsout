import { z } from 'zod';
import { ShipMergeMethod } from '#src/contracts/ship/ShipMergeMethod.ts';

/**
 * Every tracker convention lives here, so no tracker vocabulary reaches engine
 * source. `.strict()` so a typo fails loudly instead of silently disabling a
 * setting.
 */
export const ConfigShip = z
	.object({
		/**
		 * A JavaScript regular expression source matched against the branch name.
		 * It must carry a named group `ticket`; that group's value becomes the
		 * result's `ticketRef`. Every other named group becomes a token the
		 * `pr-body` template may use. Default `^(?<ticket>[a-z]+-\d+)`.
		 *
		 * The same pattern is what a plan folder's name is read for a ticket id
		 * with, since a plan folder is named after its branch — there is no
		 * second key for that, so the two formats cannot drift apart.
		 */
		'ticket-pattern': z.string().optional(),
		/**
		 * The pull request body template. Brace-wrapped tokens are substituted:
		 * `branch`, and one per named group of the ticket pattern. An unknown
		 * token is left exactly as written. The default is the bare ticket token
		 * on its own, which is deliberately inert — a body that closes something
		 * automatically is a tracker's convention, not the engine's.
		 */
		'pr-body': z.string().optional(),
		/** How the forge merges. Default `merge`. */
		'merge-method': z.enum(ShipMergeMethod).optional(),
		/**
		 * A shell command run in the checkout to prepare the release candidate —
		 * the home for a repository's own pre-ship convention, such as rebuilding
		 * committed build outputs or bumping a shipped version. Ship requires a
		 * clean committed branch before it runs, runs it against the freshly
		 * fetched default branch, and commits what it leaves behind only once the
		 * repository's own gates have passed against it. A non-zero exit blocks
		 * the ship with the command's own output. Unset means no such step.
		 */
		'pre-ship': z.string().optional(),
		/**
		 * When true, a pull request whose check list is readable and genuinely
		 * empty may merge after the usual registration grace — the explicit
		 * opt-out for a repository that intentionally has no CI. Default false,
		 * and never set automatically. It applies only to absent checks: failed,
		 * pending, unreadable and another commit's checks are still enforced.
		 */
		'allow-no-ci': z.boolean().optional(),
		/** When true, a passed `lightsout implement` run chains into ship without `--ship` being typed. Default false. */
		'after-implement': z.boolean().optional(),
	})
	.strict();

export type ConfigShip = z.infer<typeof ConfigShip>;
