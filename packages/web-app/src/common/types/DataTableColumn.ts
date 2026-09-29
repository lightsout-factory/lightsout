import type { ReactNode } from 'react';
import type { TableAlignment } from '#src/common/constants/TableAlignment.ts';

export interface DataTableColumn<TRow> {
	/** Stable key; also the sort key a sortable header emits. */
	key: string;
	header: ReactNode;
	align?: TableAlignment;
	/** Omitted, the column is not sortable. */
	sortValue?: (row: TRow) => string | number;
	render: (row: TRow) => ReactNode;
	className?: string;
}
