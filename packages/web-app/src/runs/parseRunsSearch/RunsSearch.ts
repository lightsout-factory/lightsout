import type { SortDirection } from '#src/common/constants/SortDirection.ts';
import type { RunsSortKey } from '#src/runs/common/constants/RunsSortKey.ts';

/** The runs page's filters and ordering, as the URL carries them; every field absent means the page's own defaults. */
export interface RunsSearch {
	commands?: string[];
	statuses?: string[];
	text?: string;
	sortKey?: RunsSortKey;
	sortDirection?: SortDirection;
}
