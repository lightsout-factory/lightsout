import { createFileRoute } from '@tanstack/react-router';
import { parseRunsSearch } from '#src/runs/parseRunsSearch/parseRunsSearch.ts';
import { RunsScreen } from '#src/runs/RunsScreen/RunsScreen.tsx';
import { runsQueryOptions } from '#src/runs/runsQueryOptions.ts';

export const Route = createFileRoute('/app/runs')({
	validateSearch: parseRunsSearch,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(runsQueryOptions());
	},
	head: () => ({ meta: [{ title: 'Runs' }] }),
	component: RunsScreen,
});
