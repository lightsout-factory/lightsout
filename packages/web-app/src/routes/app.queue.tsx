import { createFileRoute } from '@tanstack/react-router';
import { queueViewQueryOptions } from '#src/features/queue/queries/queueViewQueryOptions.ts';
import { QueueScreen } from '#src/features/queue/screens/QueueScreen.tsx';

export const Route = createFileRoute('/app/queue')({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(queueViewQueryOptions());
	},
	head: () => ({ meta: [{ title: 'Queue' }] }),
	component: QueueScreen,
});
