import { createFileRoute } from '@tanstack/react-router';
import { WorkOrdersScreen } from '#src/features/workOrders/screens/WorkOrdersScreen.tsx';

export const Route = createFileRoute('/app/')({
	head: () => ({ meta: [{ title: 'Work orders' }] }),
	component: WorkOrdersScreen,
});
