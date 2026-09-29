import type { ShipMergeMethod } from '#src/contracts/ship/ShipMergeMethod.ts';

// The `ship` config block with every default applied, resolved once at the edge
// so no step downstream re-decides one.
export interface ShipSettings {
	/** Compiled from the config's `ticket-pattern` source. */
	ticketPattern: RegExp;
	/** The `pr-body` template, tokens unsubstituted. */
	pullRequestBody: string;
	mergeMethod: ShipMergeMethod;
	/** Whether a passed implement run chains into ship without `--ship`. */
	afterImplement: boolean;
	/** The `pre-ship` command, run against the freshly fetched base before verification. Undefined when the repo has no such convention. */
	preShip: string | undefined;
	/** Whether a readable, genuinely empty check list may merge. Resolved once at the edge and immutable for the invocation, repairs included. */
	allowNoCi: boolean;
}
