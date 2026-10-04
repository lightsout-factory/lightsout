import type { ShipRequestTerms } from '#src/common/types/ShipRequestTerms.ts';

export interface WorkOrderRunTerms {
	/** The one sentence saying why this plan may not be built yet, or undefined when it may. */
	refusal?: string;
	/** The ticket's own say over this run's shipping. Absent where `--ship` and `ship.after-implement` decide it. */
	shipRequest?: ShipRequestTerms;
}
