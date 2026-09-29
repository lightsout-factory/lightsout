import { SortableHeader } from '#src/appUI/SortableHeader.tsx';
import { SortDirection } from '#src/common/constants/SortDirection.ts';
import { TableAlignment, tableAlignmentClasses } from '#src/common/constants/TableAlignment.ts';
import type { DataTableColumn } from '#src/common/types/DataTableColumn.ts';
import { cn } from '#src/common/utils/cn.ts';

const ariaSortOf = ({ isActive, direction }: { isActive: boolean; direction?: SortDirection }) => {
	const active = direction === SortDirection.Descending ? 'descending' : 'ascending';

	return isActive ? active : 'none';
};

interface Props<TRow> {
	columns: Array<DataTableColumn<TRow>>;
	sortKey?: string;
	sortDirection?: SortDirection;
	onSort?: (params: { key: string; direction: SortDirection }) => void;
	/** The table carries a disclosure column, so the header needs its matching blank cell. */
	hasDisclosure?: boolean;
}

export const DataTableHeader = <TRow,>({ columns, sortKey, sortDirection, onSort, hasDisclosure = false }: Props<TRow>) => (
	<thead className="border-border border-b text-muted-foreground text-xs">
		<tr>
			{hasDisclosure ? <th scope="col" className="w-8 px-3 py-2" /> : null}
			{columns.map((column) => (
				<th
					key={column.key}
					scope="col"
					aria-sort={column.sortValue === undefined ? undefined : ariaSortOf({ isActive: column.key === sortKey, direction: sortDirection })}
					className={cn('whitespace-nowrap px-3 py-2 font-medium', tableAlignmentClasses[column.align ?? TableAlignment.Left], column.className)}
				>
					{column.sortValue === undefined || onSort === undefined ? (
						column.header
					) : (
						<SortableHeader label={column.header} sortKey={column.key} activeKey={sortKey} direction={sortDirection} onSort={onSort} />
					)}
				</th>
			))}
		</tr>
	</thead>
);
