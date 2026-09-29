import { createFileRoute } from '@tanstack/react-router';
import { AddressNotFound } from '#src/common/components/boundaries/AddressNotFound.tsx';
import { planWorkspaceQueryOptions } from '#src/features/plans/queries/planWorkspaceQueryOptions.ts';
import { PlanDetail } from '#src/features/plans/screens/PlanDetail/PlanDetail.tsx';

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

	return <PlanDetail name={name} />;
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
