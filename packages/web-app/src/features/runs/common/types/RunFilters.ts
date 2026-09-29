import type { SortDirection } from '#src/common/constants/SortDirection.ts';

export interface RunFilters {
	/** Command values from `getRunCommand`; empty means all. */
	commands: string[];
	/** Status families from `runStatusFamilies`; empty means all. */
	statuses: string[];
	/** Case-insensitive substring over the title. */
	text?: string;
	sortKey?: string;
	sortDirection?: SortDirection;
}
