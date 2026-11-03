import { createFileRoute } from '@tanstack/react-router';
import { planWorkspaceQueryOptions } from '#src/features/plans/queries/planWorkspaceQueryOptions.ts';
import { PlanDetailScreen } from '#src/features/plans/screens/PlanDetailScreen.tsx';
import { PlanNotFoundScreen } from '#src/features/plans/screens/PlanNotFoundScreen.tsx';

/** Reached because `getPlanWorkspaceServerFn` turns `PlanWorkspaceNotFoundError` into `notFound()` on the server. */
const PlanNotFound = () => {
	const { name } = Route.useParams();

	return <PlanNotFoundScreen name={name} />;
};

const PlanDetailPage = () => {
	const { name } = Route.useParams();

	return <PlanDetailScreen name={name} />;
};

export const Route = createFileRoute('/app/plans/$name')({
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(planWorkspaceQueryOptions({ name: params.name }));
	},
	// From the path alone, so the tab is named before the query resolves.
	head: ({ params }) => ({ meta: [{ title: `${params.name} — plan` }] }),
	component: PlanDetailPage,
	notFoundComponent: PlanNotFound,
});
