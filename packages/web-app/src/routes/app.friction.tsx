import { createFileRoute } from '@tanstack/react-router';
import { FrictionScreen } from '#src/friction/FrictionScreen/FrictionScreen.tsx';
import { frictionQueryOptions } from '#src/friction/frictionQueryOptions.ts';
import { runsQueryOptions } from '#src/runs/runsQueryOptions.ts';

export const Route = createFileRoute('/app/friction')({
	// Both warmed here: the page suspends on the log, and the runs are what put a
	// title beside a run id rather than a bare short id.
	loader: async ({ context }) => {
		await Promise.all([context.queryClient.ensureQueryData(frictionQueryOptions()), context.queryClient.ensureQueryData(runsQueryOptions())]);
	},
	head: () => ({ meta: [{ title: 'Friction' }] }),
	component: FrictionScreen,
});
