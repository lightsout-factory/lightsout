import { PipelineKind } from '@lightsout/engine/contracts';
import type { RunDetailView } from '#src/features/runDetail/internal/common/types/RunDetailView.ts';
import { AgentCostPanel } from '#src/features/runDetail/screens/RunDetail/internal/components/AgentCostPanel.tsx';
import { CoordinatorNote } from '#src/features/runDetail/screens/RunDetail/internal/components/CoordinatorNote.tsx';

interface Props {
	view: RunDetailView;
}

export const RunAgentsTab = ({ view }: Props) =>
	view.listing.pipeline === PipelineKind.Phases ? (
		<CoordinatorNote />
	) : (
		<AgentCostPanel usage={view.usage} cacheReadShare={view.cacheReadShare} steps={view.steps} agents={view.agents} rejectedReports={view.rejectedReports} />
	);
