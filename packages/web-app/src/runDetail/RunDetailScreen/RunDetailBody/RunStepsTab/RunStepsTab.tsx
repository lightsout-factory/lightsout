import type { RunDetailView } from '#src/runDetail/common/types/RunDetailView.ts';
import { StepCard } from '#src/runDetail/RunDetailScreen/RunDetailBody/RunStepsTab/StepCard/StepCard.tsx';

interface Props {
	view: RunDetailView;
	/** Opens a repo-relative plan path in the drawer the page owns. */
	onOpenPlan: (path: string) => void;
}

export const RunStepsTab = ({ view, onOpenPlan }: Props) => (
	<div className="flex flex-col gap-3">
		{view.steps.map((step) => (
			<StepCard key={step.id} step={step} onOpenPlan={onOpenPlan} />
		))}
	</div>
);
