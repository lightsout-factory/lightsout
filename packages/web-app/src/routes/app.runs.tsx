import { createFileRoute } from '@tanstack/react-router';
import { RunsScreen } from '#src/features/runs/screens/RunsScreen.tsx';
import { parseRunsSearch } from '#src/features/runs/utils/parseRunsSearch.ts';
import { runsQueryOptions } from '#src/queries/runsQueryOptions.ts';

export const Route = createFileRoute('/app/runs')({
	validateSearch: parseRunsSearch,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(runsQueryOptions());
	},
	head: () => ({ meta: [{ title: 'Runs' }] }),
	component: RunsScreen,
});
