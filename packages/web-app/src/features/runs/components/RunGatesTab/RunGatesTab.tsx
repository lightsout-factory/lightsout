import { PipelineKind } from '@lightsout/engine/contracts';
import { CoordinatorNote } from '#src/features/runs/components/CoordinatorNote.tsx';
import { GateEvidencePanel } from '#src/features/runs/components/RunGatesTab/GateEvidencePanel.tsx';
import type { RunDetailView } from '#src/features/runs/types/RunDetailView.ts';

interface Props {
	view: RunDetailView;
}

export const RunGatesTab = ({ view }: Props) =>
	view.listing.pipeline === PipelineKind.Phases ? <CoordinatorNote /> : <GateEvidencePanel gates={view.gates} totals={view.gateTotals} showStep />;
