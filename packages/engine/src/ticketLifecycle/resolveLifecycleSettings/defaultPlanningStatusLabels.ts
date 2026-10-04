import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';

/** The planning status verbatim, because the `planning-` prefix already reads as a classification on a tracker. */
export const defaultPlanningStatusLabels: Record<PlanningStatus, string> = {
	[PlanningStatus.NeedsBrainstorm]: 'planning-needs-brainstorm',
	[PlanningStatus.NeedsPlan]: 'planning-needs-plan',
	[PlanningStatus.ReadyAutoPlan]: 'planning-ready-auto-plan',
	[PlanningStatus.Complete]: 'planning-complete',
	[PlanningStatus.NotNeeded]: 'planning-not-needed',
};
