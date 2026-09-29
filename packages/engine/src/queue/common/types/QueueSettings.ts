import type { LifecycleSettings } from '#src/ticketLifecycle/common/types/LifecycleSettings.ts';

/**
 * The `queue` config block with every default already applied, resolved once at
 * the edge so no step downstream re-decides one.
 *
 * Lifecycle labels and names are resolved by the lifecycle module rather than
 * owned here, because the command edge writes them without a queue.
 */
export interface QueueSettings {
	lifecycle: LifecycleSettings;
	maxParallel: number;
	/** Command run once in a fresh worktree; undefined when the repo needs none. */
	setup?: string;
	/** Branch-name template with `{ticket}` and `{slug}` tokens, default applied. */
	branchTemplate: string;
	/** The ticket-body heading relayed answers land under, default applied. */
	decisionsHeading: string;
	/** Ceiling for one ticket's auto-plan worker session in milliseconds, parsed from `worker-timeout`. */
	workerTimeoutMs: number;
	/** How long one relayed question waits before the ticket parks, in milliseconds, parsed from `question-timeout`. Only the file relay observes it. */
	questionTimeoutMs: number;
	/** The ticket label set on park and cleared on resume or ship; undefined when the repo opted out. */
	parkedLabel?: string;
}
