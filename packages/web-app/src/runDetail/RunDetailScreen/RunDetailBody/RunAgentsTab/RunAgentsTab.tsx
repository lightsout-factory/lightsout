import { PipelineKind } from '@lightsout/engine/contracts';
import type { RunDetailView } from '#src/runDetail/common/types/RunDetailView.ts';
import { CoordinatorNote } from '#src/runDetail/RunDetailScreen/RunDetailBody/common/CoordinatorNote.tsx';
import { AgentCostPanel } from '#src/runDetail/RunDetailScreen/RunDetailBody/RunAgentsTab/AgentCostPanel.tsx';

interface Props {
	view: RunDetailView;
}

export const RunAgentsTab = ({ view }: Props) =>
	view.listing.pipeline === PipelineKind.Phases ? (
		<CoordinatorNote />
	) : (
		<AgentCostPanel usage={view.usage} cacheReadShare={view.cacheReadShare} steps={view.steps} agents={view.agents} rejectedReports={view.rejectedReports} />
	);
