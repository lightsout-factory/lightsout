import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ScrollText } from 'lucide-react';
import { PageHeader } from '#src/components/ui/PageHeader.tsx';
import { SortDirection } from '#src/constants/SortDirection.ts';
import { RunsFilterBar } from '#src/features/runs/components/RunsFilterBar.tsx';
import { RunsTable } from '#src/features/runs/components/RunsTable/RunsTable.tsx';
import { RunsSortKey } from '#src/features/runs/constants/RunsSortKey.ts';
import type { RunFilters } from '#src/features/runs/types/RunFilters.ts';
import { runsQueryOptions } from '#src/queries/runsQueryOptions.ts';
import { formatCount } from '#src/utils/formatCount.ts';

const readSortKey = ({ key }: { key?: string }) => Object.values(RunsSortKey).find((candidate) => candidate === key);

/**
 * The filters live in the URL so a narrowed table is a link somebody can send.
 * Writes replace rather than push, so back leaves the page instead of unwinding
 * one filter edit at a time.
 */
export const RunsScreen = () => {
	const { data: runs } = useSuspenseQuery(runsQueryOptions());
	const search = useSearch({ from: '/app/runs' });
	const navigate = useNavigate({ from: '/app/runs' });
	const filters: RunFilters = {
		commands: search.commands ?? [],
		statuses: search.statuses ?? [],
		text: search.text,
		sortKey: search.sortKey ?? RunsSortKey.Updated,
		sortDirection: search.sortDirection ?? SortDirection.Descending,
	};
	const write = ({ next }: { next: RunFilters }) => {
		void navigate({
			search: {
				commands: next.commands.length === 0 ? undefined : next.commands,
				statuses: next.statuses.length === 0 ? undefined : next.statuses,
				text: next.text,
				sortKey: readSortKey({ key: next.sortKey }),
				sortDirection: next.sortDirection,
			},
			replace: true,
		});
	};

	return (
		<div className="flex flex-col gap-4 p-6">
			<PageHeader icon={ScrollText} title="Runs" description={formatCount({ count: runs.length, noun: 'run' })} />
			<RunsFilterBar runs={runs} filters={filters} onChange={(next) => write({ next })} />
			<RunsTable
				runs={runs}
				filters={filters}
				onSort={({ key, direction }) => write({ next: { ...filters, sortKey: key, sortDirection: direction } })}
				onClearFilters={() => write({ next: { commands: [], statuses: [], sortKey: filters.sortKey, sortDirection: filters.sortDirection } })}
			/>
		</div>
	);
};
