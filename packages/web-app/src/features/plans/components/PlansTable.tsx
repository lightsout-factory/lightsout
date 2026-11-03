import type { PlanWorkspaceListing } from '@lightsout/engine';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { DataTable } from '#src/components/tables/DataTable/DataTable.tsx';
import { StatusBadge } from '#src/components/ui/StatusBadge.tsx';
import { SortDirection } from '#src/constants/SortDirection.ts';
import { TableAlignment } from '#src/constants/TableAlignment.ts';
import { planGradeBadgeConfig } from '#src/features/plans/constants/planGradeBadgeConfig.ts';
import { planStageBadgeConfig } from '#src/features/plans/constants/planStageBadgeConfig.ts';
import type { DataTableColumn } from '#src/types/DataTableColumn.ts';
import { formatRelativeTime } from '#src/utils/formatRelativeTime.ts';

/** What happened most recently is what a reader is looking for. */
const defaultSortKey = 'updatedAt';

const PlanLink = ({ listing }: { listing: PlanWorkspaceListing }) => (
	<Link to="/app/plans/$name" params={{ name: listing.name }} className="font-medium hover:underline hover:underline-offset-2">
		{listing.name}
	</Link>
);

const columns: Array<DataTableColumn<PlanWorkspaceListing>> = [
	{ key: 'name', header: 'plan', sortValue: (listing) => listing.name, render: (listing) => <PlanLink listing={listing} /> },
	{
		key: 'stage',
		header: 'stage',
		sortValue: (listing) => listing.stage,
		render: (listing) => <StatusBadge status={listing.stage} config={planStageBadgeConfig} />,
	},
	{
		key: 'grade',
		header: 'grade',
		sortValue: (listing) => listing.grade ?? '',
		render: (listing) => (listing.grade === undefined ? '—' : <StatusBadge status={listing.grade} config={planGradeBadgeConfig} />),
	},
	{
		key: 'phases',
		header: 'phases',
		align: TableAlignment.Right,
		sortValue: (listing) => listing.phaseCount,
		// A single plan has no phases to count, and a dash says that rather than
		// claiming it has zero of something it never had.
		render: (listing) => (listing.phased ? listing.phaseCount : '—'),
	},
	{ key: 'runs', header: 'runs', align: TableAlignment.Right, sortValue: (listing) => listing.runCount, render: (listing) => listing.runCount },
	{
		key: defaultSortKey,
		header: 'updated',
		sortValue: (listing) => listing.updatedAt,
		render: (listing) => <span className="whitespace-nowrap text-muted-foreground">{formatRelativeTime({ at: listing.updatedAt })}</span>,
	},
];

interface Props {
	listings: PlanWorkspaceListing[];
	/** What the table says when `listings` is empty. Each consumer knows why its own list is empty; the table does not. */
	empty: ReactNode;
}

/** The ordering is component state, not the URL's: a shared table cannot write to a route it does not know it is on. */
export const PlansTable = ({ listings, empty }: Props) => {
	const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({ key: defaultSortKey, direction: SortDirection.Descending });

	return (
		<DataTable
			rows={listings}
			columns={columns}
			getRowKey={(listing) => listing.name}
			sortKey={sort.key}
			sortDirection={sort.direction}
			onSort={({ key, direction }) => setSort({ key, direction })}
			empty={empty}
		/>
	);
};
