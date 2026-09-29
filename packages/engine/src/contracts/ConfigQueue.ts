import { z } from 'zod';

/**
 * Tracker identity lives in `ConfigTicketTracker` instead, because publishing a
 * plan to its ticket needs it without a queue. `.strict()` so a typo fails
 * loudly instead of silently disabling a setting.
 */
export const ConfigQueue = z
	.object({
		/**
		 * The tracker label naming each planning status. Each key is optional and
		 * defaults to the planning status verbatim, so a repo overrides only the
		 * label it spells differently. Exactly one of these labels on a ticket is
		 * the human's opt-in to automation.
		 */
		'planning-status-labels': z
			.object({
				'planning-needs-brainstorm': z.string().optional(),
				'planning-needs-plan': z.string().optional(),
				'planning-ready-auto-plan': z.string().optional(),
				'planning-complete': z.string().optional(),
				'planning-not-needed': z.string().optional(),
			})
			.strict()
			.optional(),
		/** How many tickets may be in flight at once. Also the ceiling on how many questions can ever wait for the user at the same time. */
		'max-parallel': z.number().int().positive(),
		/** Ticket statuses the queue may pick up. Default `['Backlog', 'Ready to implement']`. */
		'eligible-statuses': z.array(z.string()).optional(),
		/** This tracker's name for the status a ticket waits at once shaping is finished or was never needed. Default `'Ready to implement'`. */
		'ready-status': z.string().optional(),
		/** Status the queue moves a ticket to when it picks it up. Default `'In Progress'`. */
		'in-progress-status': z.string().optional(),
		/** This tracker's name for the status a ticket reaches once its merge is confirmed. Default `'Done'`. */
		'done-status': z.string().optional(),
		/**
		 * How a ticket becomes a branch name. `{ticket}` is the lowercased
		 * identifier, `{slug}` the slugged title. Default `{ticket}-{slug}`.
		 * A company convention like `feature/{ticket}-{slug}` goes here — and
		 * whatever it produces must be matched by `ship.ticket-pattern`, which
		 * is equally the repo's to configure.
		 */
		'branch-template': z.string().optional(),
		/**
		 * The ticket-body heading relayed answers are appended under. A
		 * tracker convention, so a config value. Default `## Decisions`.
		 */
		'decisions-heading': z.string().optional(),
		/**
		 * Ceiling for one ticket's auto-plan worker session — the session that
		 * plans a ticket and sits through the implement run it launches. Per
		 * ticket, never for the drain: the queue itself has no ceiling and runs
		 * until the backlog is dry. A hit ceiling parks the ticket resumably,
		 * exactly like every other agent timeout. A duration string like '90s',
		 * '45m' or '4h'. Default `'4h'`.
		 */
		'worker-timeout': z.string().optional(),
		/**
		 * How long one relayed question waits for an answer before its ticket
		 * parks. A duration string like '90s', '45m' or '4h'. Default `'1h'`.
		 * Only `--file-relay` observes it: the terminal relay waits on a person
		 * who is present, and gives up when their terminal goes away.
		 */
		'question-timeout': z.string().optional(),
		/**
		 * The ticket label the queue sets when a ticket parks and clears when it
		 * resumes or ships. Opt-in with no default — a repo that names none never
		 * has one invented for it. The tracker adapter makes it usable on first use.
		 */
		'parked-label': z.string().optional(),
	})
	.strict();

export type ConfigQueue = z.infer<typeof ConfigQueue>;
