import type { FrictionArea, FrictionRecord, RunListing } from '@lightsout/engine';
import { formatShortRunId } from '@lightsout/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { MessageSquareWarning } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '#src/common/badges/Badge.tsx';
import { MetadataTag } from '#src/common/badges/MetadataTag.tsx';
import { Button } from '#src/common/controls/Button.tsx';
import { CopyButton } from '#src/common/controls/CopyButton.tsx';
import { formatCount } from '#src/common/formatCount.ts';
import { PageHeader } from '#src/common/headers/PageHeader.tsx';
import { EmptyState } from '#src/common/panels/EmptyState.tsx';
import { DataTable } from '#src/common/tables/DataTable/DataTable.tsx';
import type { DataTableColumn } from '#src/common/types/DataTableColumn.ts';
import { countFrictionByArea } from '#src/friction/FrictionScreen/countFrictionByArea.ts';
import { filterFriction } from '#src/friction/FrictionScreen/filterFriction.ts';
import { frictionQueryOptions } from '#src/friction/frictionQueryOptions.ts';
import { runsQueryOptions } from '#src/runs/runsQueryOptions.ts';

const improveCommand = 'lightsout improve --engine <path>';

const RunCell = ({ record, runs }: { record: FrictionRecord; runs: RunListing[] }) => {
	const listing = runs.find((run) => run.runId === record.runId);

	return listing === undefined ? (
		<MetadataTag title={record.runId}>{formatShortRunId({ runId: record.runId })}</MetadataTag>
	) : (
		<Link to="/app/runs/$runId" params={{ runId: record.runId }} className="flex min-w-0 items-center gap-2 hover:underline hover:underline-offset-2">
			<MetadataTag>{listing.shortId}</MetadataTag>
			<span className="min-w-0 truncate">{listing.title}</span>
		</Link>
	);
};

const buildColumns = ({ runs }: { runs: RunListing[] }): Array<DataTableColumn<FrictionRecord>> => [
	{ key: 'area', header: 'area', render: (record) => <Badge>{record.area}</Badge> },
	{ key: 'kind', header: 'kind', render: (record) => <span className="text-muted-foreground">{record.kind ?? 'friction'}</span> },
	{ key: 'run', header: 'run', render: (record) => <RunCell record={record} runs={runs} /> },
	{ key: 'step', header: 'step', render: (record) => <MetadataTag>{record.step}</MetadataTag> },
	{ key: 'detail', header: 'detail', className: 'max-w-xl', render: (record) => <span className="leading-5">{record.detail}</span> },
];

/**
 * Suspends on the log but only subscribes to the runs: they just put a title
 * beside a run id, and waiting on them would stall on data no filter reads.
 */
export const FrictionScreen = () => {
	const { data: records } = useSuspenseQuery(frictionQueryOptions());
	const { data: runs = [] } = useQuery(runsQueryOptions());
	const [areas, setAreas] = useState<FrictionArea[]>([]);
	const [text, setText] = useState('');
	const rows = [...filterFriction({ records, areas, text })].sort((first, second) => second.at.localeCompare(first.at));

	return (
		<div className="flex flex-col gap-4 p-6">
			<PageHeader
				icon={MessageSquareWarning}
				title="Friction"
				description={`What agents reported as getting in their way · ${formatCount({ count: records.length, noun: 'entry', plural: 'entries' })}`}
			/>
			<div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
				{countFrictionByArea({ records }).map(({ area, count }) => (
					<Button
						key={area}
						type="button"
						size="sm"
						variant={areas.includes(area) ? 'outline' : 'ghost'}
						aria-pressed={areas.includes(area)}
						onClick={() => setAreas(areas.includes(area) ? areas.filter((entry) => entry !== area) : [...areas, area])}
					>
						{area}
						<span className="text-muted-foreground text-xs">{count}</span>
					</Button>
				))}
				<input
					type="search"
					aria-label="Filter friction by what was reported"
					placeholder="Filter by detail"
					value={text}
					onChange={(event) => setText(event.target.value)}
					className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring"
				/>
			</div>
			<DataTable
				rows={rows}
				columns={buildColumns({ runs })}
				getRowKey={(record) => `${record.at}:${record.runId}:${record.step}:${record.detail}`}
				empty={
					records.length === 0 ? (
						<EmptyState
							icon={MessageSquareWarning}
							title="No friction on record."
							description="Agents report this as they work — it fills in as runs finish."
						/>
					) : (
						<EmptyState title="No entries match these filters." />
					)
				}
			/>
			<p className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
				Feed this back with <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">{improveCommand}</code>
				<CopyButton value={improveCommand} label="Copy improve command" />
			</p>
		</div>
	);
};
