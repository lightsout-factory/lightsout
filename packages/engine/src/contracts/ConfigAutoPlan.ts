import { z } from 'zod';

/**
 * Every key is off by default, so an absent block is the most supervised
 * behaviour: the skill plans the whole ticket, shows one proposal, and stops.
 *
 * No engine code reads this block; the skill reads it straight off the file. It
 * is declared here so `doctor` and the config view can see it, and `.strict()`
 * so a typo fails loudly instead of silently disabling a setting.
 */
export const ConfigAutoPlan = z
	.object({
		/**
		 * When true the proposal comes before `plan draft` spends an agent, and
		 * carries the design shape rather than the finished plan. Default false:
		 * the proposal shows the real, graded plan.
		 */
		'propose-before-draft': z.boolean().optional(),
		/**
		 * When true an approved proposal starts `lightsout implement` rather than
		 * stopping at the handoff line. Default false — auto-plan only plans.
		 */
		'implement-on-approval': z.boolean().optional(),
		/**
		 * When true the proposal is skipped entirely, provided nothing cleared the
		 * escalation bar; a question that clears it parks the run instead of being
		 * guessed past. Default false.
		 */
		'auto-approve-plan': z.boolean().optional(),
	})
	.strict();

export type ConfigAutoPlan = z.infer<typeof ConfigAutoPlan>;
