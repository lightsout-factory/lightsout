/**
 * Declared in `ship` because a `ticket` import from here would close a cycle in
 * the module graph.
 *
 * Its presence means the ticket's own record decides the run's shipping; its
 * absence means `--ship` and `ship.after-implement` decide it.
 */
export interface ShipRequestTerms {
	/** Why a passing run will not satisfy the ticket's ship request, or undefined when it will. */
	blocker: string | undefined;
}
