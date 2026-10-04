import { defaultPlanningStatusLabels, PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import { TrackerStatusRole } from '#src/common/constants/TrackerStatusRole.ts';
import type { LifecycleSettings } from '#src/common/types/LifecycleSettings.ts';
import type { TrackerFailure } from '#src/common/types/TrackerFailure.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

interface Params {
	config: LightsoutConfig;
}

// Annotated because inference would widen each branch with the other's absent
// key, so neither would satisfy the resolved settings the caller returns.
const readPlanningStatusLabels = ({
	queue,
}: {
	queue: LightsoutConfig['queue'];
}): { planningStatusLabels: Record<PlanningStatus, string> } | TrackerFailure => {
	const configured = queue?.['planning-status-labels'];
	const named = ({ status }: { status: PlanningStatus }) => configured?.[status] ?? defaultPlanningStatusLabels[status];
	const planningStatusLabels: Record<PlanningStatus, string> = {
		[PlanningStatus.NeedsBrainstorm]: named({ status: PlanningStatus.NeedsBrainstorm }),
		[PlanningStatus.NeedsPlan]: named({ status: PlanningStatus.NeedsPlan }),
		[PlanningStatus.ReadyAutoPlan]: named({ status: PlanningStatus.ReadyAutoPlan }),
		[PlanningStatus.Complete]: named({ status: PlanningStatus.Complete }),
		[PlanningStatus.NotNeeded]: named({ status: PlanningStatus.NotNeeded }),
	};

	for (const label of new Set(Object.values(planningStatusLabels))) {
		const sharing = Object.values(PlanningStatus).filter((status) => planningStatusLabels[status] === label);

		if (sharing.length > 1) {
			return {
				error: `\`queue.planning-status-labels\` maps '${label}' to both ${sharing.join(' and ')} — one label cannot mean two planning statuses`,
			};
		}
	}

	return { planningStatusLabels };
};

/**
 * Every value has a default, because writing a ticket's planning status needs
 * no queue at all.
 *
 * One label mapped to two planning statuses is refused here: a strict five-key
 * object does not stop the same string twice, and the ticket would be reported
 * ambiguous and skipped by the queue forever.
 */
export const resolveLifecycleSettings = ({ config }: Params): LifecycleSettings | TrackerFailure => {
	const queue = config.queue;
	const labels = readPlanningStatusLabels({ queue });

	if ('error' in labels) {
		return labels;
	}

	return {
		planningStatusLabels: labels.planningStatusLabels,
		statusNames: {
			[TrackerStatusRole.Ready]: queue?.['ready-status'] ?? 'Ready to implement',
			[TrackerStatusRole.InProgress]: queue?.['in-progress-status'] ?? 'In Progress',
			[TrackerStatusRole.Done]: queue?.['done-status'] ?? 'Done',
		},
		eligibleStatuses: queue?.['eligible-statuses'] ?? ['Backlog', 'Ready to implement'],
	};
};
