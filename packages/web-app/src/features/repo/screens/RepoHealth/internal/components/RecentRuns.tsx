import type { RunListing } from '@lightsout/engine';
import { Link } from '@tanstack/react-router';
import { StatusBadge } from '#src/appUI/badges/StatusBadge.tsx';
import { DataTable } from '#src/appUI/DataTable.tsx';
import { EmptyState } from '#src/appUI/EmptyState.tsx';
import { SettingsCard } from '#src/appUI/panels/SettingsCard.tsx';
import { statusBadgeConfig } from '#src/common/constants/statusBadgeConfig.ts';
import { formatRelativeTime } from '#src/common/formatting/formatRelativeTime.ts';
import type { DataTableColumn } from '#src/common/types/DataTableColumn.ts';
import { getRunCommand } from '#src/features/runs/common/utils/getRunCommand.ts';

const columns: Array<DataTableColumn<RunListing>> = [
	{ key: 'status', header: 'status', render: (run) => <StatusBadge status={run.status} config={statusBadgeConfig} live={run.live} /> },
	{
		key: 'title',
		header: 'run',
		render: (run) => (
			<Link to="/app/runs/$runId" params={{ runId: run.runId }} className="font-medium hover:underline hover:underline-offset-2">
				{run.title}
			</Link>
		),
	},
	{ key: 'command', header: 'command', render: (run) => getRunCommand({ pipeline: run.pipeline }) },
	{
		key: 'updated',
		header: 'updated',
		render: (run) => <span className="whitespace-nowrap text-muted-foreground">{formatRelativeTime({ at: run.updatedAt })}</span>,
	},
];

interface Props {
	/** Top-level runs only, newest first. */
	runs: RunListing[];
}

/** Built on `DataTable`, not `RunsTable`: filtering, folding phase children and opening rows are the runs page's job, not a landing page's. */
export const RecentRuns = ({ runs }: Props) => {
	// How many rows a glance holds before it stops being a glance.
	const recentRunCount = 8;

	return (
		<SettingsCard
			title="Recent runs"
			action={
				<Link to="/app/runs" className="text-brand-to text-sm underline underline-offset-4">
					See all runs →
				</Link>
			}
		>
			<DataTable
				rows={runs.slice(0, recentRunCount)}
				columns={columns}
				getRowKey={(run) => run.runId}
				className="border-0"
				empty={<EmptyState title="No runs yet." description="Plan the work with /plan, then hand it over with /implement." />}
			/>
		</SettingsCard>
	);
};
