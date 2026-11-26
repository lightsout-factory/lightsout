import { createFileRoute } from '@tanstack/react-router';
import { workOrderViewQueryOptions } from '#src/features/workOrders/queries/workOrderViewQueryOptions.ts';
import { WorkOrderScreen } from '#src/features/workOrders/screens/WorkOrderScreen.tsx';

const WorkOrderPage = () => {
	const { workOrder } = Route.useParams();

	return <WorkOrderScreen name={workOrder} />;
};

// An index route, so the plan page beside it is not nested inside this one. A
// name no folder holds reaches the router's default not-found through the
// server function's `notFound()`.
export const Route = createFileRoute('/app/work-orders/$workOrder/')({
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(workOrderViewQueryOptions({ name: params.workOrder }));
	},
	// From the path alone, so the tab is named before the query resolves.
	head: ({ params }) => ({ meta: [{ title: `${params.workOrder} — Work orders` }] }),
	component: WorkOrderPage,
});
