import { StepCard } from '#src/features/runs/components/StepCard/StepCard.tsx';
import type { RunDetailView } from '#src/features/runs/types/RunDetailView.ts';

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
