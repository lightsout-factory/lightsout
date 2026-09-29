import { StatusBadge } from '#src/appUI/badges/StatusBadge.tsx';
import { statusBadgeConfig } from '#src/common/constants/statusBadgeConfig.ts';
import type { RunDetailStep } from '#src/features/runDetail/internal/common/types/RunDetailStep.ts';
import { ChildRunLink } from '#src/features/runDetail/screens/RunDetail/internal/components/ChildRunLink.tsx';

interface Props {
	steps: RunDetailStep[];
}

/** Shows the phase file's name, not its path: every phase of one plan sits in the same folder. */
export const PhaseList = ({ steps }: Props) => {
	const phases = steps.filter((step) => step.childRunId !== undefined);

	return phases.length === 0 ? null : (
		<ul className="flex flex-col gap-1">
			{phases.map((step) => (
				<li key={step.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2 text-sm">
					<span className="font-medium font-mono">{step.planPath?.split('/').pop() ?? step.id}</span>
					<StatusBadge status={step.status} config={statusBadgeConfig} />
					{step.childRunId === undefined ? null : <ChildRunLink runId={step.childRunId} />}
				</li>
			))}
		</ul>
	);
};
