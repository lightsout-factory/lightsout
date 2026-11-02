import { PipelineKind } from '@lightsout/engine/contracts';
import type { RunDetailView } from '#src/runDetail/common/types/RunDetailView.ts';
import { CoordinatorNote } from '#src/runDetail/RunDetailScreen/RunDetailBody/common/CoordinatorNote.tsx';
import { GateEvidencePanel } from '#src/runDetail/RunDetailScreen/RunDetailBody/RunGatesTab/GateEvidencePanel.tsx';

interface Props {
	view: RunDetailView;
}

export const RunGatesTab = ({ view }: Props) =>
	view.listing.pipeline === PipelineKind.Phases ? <CoordinatorNote /> : <GateEvidencePanel gates={view.gates} totals={view.gateTotals} showStep />;
