import { createFileRoute } from '@tanstack/react-router';
import { RepoHealthScreen } from '#src/repo/RepoHealthScreen/RepoHealthScreen.tsx';
import { runsQueryOptions } from '#src/runs/runsQueryOptions.ts';

export const Route = createFileRoute('/app/')({
	head: () => ({ meta: [{ title: 'Health' }] }),
	// Only the runs. The standards check and the friction log are things a repo
	// may never have produced, so the page subscribes to those rather than
	// suspending on them and a repo with neither still renders.
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(runsQueryOptions());
	},
	component: RepoHealthScreen,
});
