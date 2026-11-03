import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PlanDrawer } from '#src/features/runs/components/PlanDrawer/PlanDrawer.tsx';
import { RunDetailBody } from '#src/features/runs/components/RunDetailBody/RunDetailBody.tsx';
import { runQueryOptions } from '#src/features/runs/queries/runQueryOptions.ts';

interface Props {
	/** Full run id, or the shortened form a report printed. */
	runId: string;
}

export const RunDetailScreen = ({ runId }: Props) => {
	const { data: view } = useSuspenseQuery(runQueryOptions({ runId }));
	const [planPath, setPlanPath] = useState<string | undefined>(undefined);

	return (
		<>
			<RunDetailBody view={view} onOpenPlan={setPlanPath} />
			<PlanDrawer path={planPath} onClose={() => setPlanPath(undefined)} />
		</>
	);
};
