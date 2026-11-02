import { PlanStage } from '@lightsout/engine/contracts';
import { createFileRoute } from '@tanstack/react-router';
import { PlansScreen } from '#src/plans/PlansScreen/PlansScreen.tsx';
import { planWorkspacesQueryOptions } from '#src/plans/planWorkspacesQueryOptions.ts';

interface PlansSearch {
	stage?: PlanStage;
}

/** A value outside the stages narrows nothing rather than emptying the table. */
const validateSearch = (search: Record<string, unknown>): PlansSearch => ({
	stage: Object.values(PlanStage).find((stage) => stage === search.stage),
});

export const Route = createFileRoute('/app/plans/')({
	validateSearch,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(planWorkspacesQueryOptions());
	},
	head: () => ({ meta: [{ title: 'Plans' }] }),
	component: PlansScreen,
});
