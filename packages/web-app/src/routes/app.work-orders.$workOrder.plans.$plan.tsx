import { createFileRoute } from '@tanstack/react-router';
import { planWorkspaceQueryOptions } from '#src/features/workOrders/queries/planWorkspaceQueryOptions.ts';
import { PlanScreen } from '#src/features/workOrders/screens/PlanScreen.tsx';

const PlanPage = () => {
	const { workOrder, plan } = Route.useParams();

	return <PlanScreen workOrder={workOrder} plan={plan} />;
};

export const Route = createFileRoute('/app/work-orders/$workOrder/plans/$plan')({
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(planWorkspaceQueryOptions({ workOrder: params.workOrder, plan: params.plan }));
	},
	// From the path alone, so the tab is named before the query resolves.
	head: ({ params }) => ({ meta: [{ title: `${params.plan} — ${params.workOrder}` }] }),
	component: PlanPage,
});
