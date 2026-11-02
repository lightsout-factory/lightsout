import { createFileRoute } from '@tanstack/react-router';
import { AddressNotFound } from '#src/common/boundaries/AddressNotFound.tsx';
import { PlanDetailScreen } from '#src/plans/PlanDetailScreen/PlanDetailScreen.tsx';
import { planWorkspaceQueryOptions } from '#src/plans/planWorkspaceQueryOptions.ts';

/** Reached because `getPlanWorkspaceServerFn` turns `PlanWorkspaceNotFoundError` into `notFound()` on the server. */
const PlanNotFound = () => {
	const { name } = Route.useParams();

	return (
		<AddressNotFound title="No plan by that name.">
			Nothing under <span className="font-mono">.lightsout/plans/</span> is named <span className="font-mono">{name}</span>. Pick one from the plans list.
		</AddressNotFound>
	);
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
