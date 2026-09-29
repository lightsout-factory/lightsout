import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { PageHeader } from '#src/appUI/headers/PageHeader.tsx';
import { frictionQueryOptions } from '#src/features/friction/queries/frictionQueryOptions.ts';
import { HealthTiles } from '#src/features/repo/screens/RepoHealth/internal/components/HealthTiles.tsx';
import { NeedsYouPanel } from '#src/features/repo/screens/RepoHealth/internal/components/NeedsYouPanel.tsx';
import { RecentRuns } from '#src/features/repo/screens/RepoHealth/internal/components/RecentRuns.tsx';
import { RepoStrip } from '#src/features/repo/screens/RepoHealth/internal/components/RepoStrip.tsx';
import { TopRulesPanel } from '#src/features/repo/screens/RepoHealth/internal/components/TopRulesPanel.tsx';
import { runsQueryOptions } from '#src/features/runs/queries/runsQueryOptions.ts';
import { standardsQueryOptions } from '#src/features/standards/queries/standardsQueryOptions.ts';

/**
 * Suspends on the runs alone: a repo may never have produced a standards check
 * or a friction log, and waiting on either would leave a new repo's landing page blank.
 *
 * Run counts use top-level runs only; `HealthTiles` gets the unfiltered list
 * because its spend tile must include the phase children.
 */
export const RepoHealth = () => {
	const { data: runs } = useSuspenseQuery(runsQueryOptions());
	const { data: standards } = useQuery(standardsQueryOptions());
	const { data: friction } = useQuery(frictionQueryOptions());

	const topLevel = [...runs.filter((run) => run.parentRunId === undefined)].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));

	return (
		<div className="flex flex-col gap-4 p-6">
			<PageHeader icon={Activity} title="Health" description={<RepoStrip runs={topLevel} />} />
			<NeedsYouPanel runs={topLevel} />
			<HealthTiles runs={runs} standards={standards} friction={friction} />
			<div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_22rem]">
				<RecentRuns runs={topLevel} />
				{standards === undefined ? null : <TopRulesPanel rules={standards.rules} />}
			</div>
		</div>
	);
};
