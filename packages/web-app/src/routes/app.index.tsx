import { createFileRoute } from '@tanstack/react-router';
import { workOrderSummariesQueryOptions } from '#src/features/workOrders/queries/workOrderSummariesQueryOptions.ts';
import { WorkOrdersScreen } from '#src/features/workOrders/screens/WorkOrdersScreen.tsx';

export const Route = createFileRoute('/app/')({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(workOrderSummariesQueryOptions());
	},
	head: () => ({ meta: [{ title: 'Work orders' }] }),
	component: WorkOrdersScreen,
});
