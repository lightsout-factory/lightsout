import { PipelineKind } from '@lightsout/engine/contracts';
import { CoordinatorNote } from '#src/features/runs/components/CoordinatorNote.tsx';
import { AgentCostPanel } from '#src/features/runs/components/RunAgentsTab/AgentCostPanel.tsx';
import type { RunDetailView } from '#src/features/runs/types/RunDetailView.ts';

interface Props {
	view: RunDetailView;
}

export const RunAgentsTab = ({ view }: Props) =>
	view.listing.pipeline === PipelineKind.Phases ? (
		<CoordinatorNote />
	) : (
		<AgentCostPanel usage={view.usage} cacheReadShare={view.cacheReadShare} steps={view.steps} agents={view.agents} rejectedReports={view.rejectedReports} />
	);
