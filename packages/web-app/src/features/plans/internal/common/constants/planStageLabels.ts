import { PlanStage } from '@lightsout/engine/contracts';

export const planStageLabels: Record<PlanStage, string> = {
	[PlanStage.Started]: 'started',
	[PlanStage.NotesOnly]: 'notes only',
	[PlanStage.Drafted]: 'drafted',
	[PlanStage.Graded]: 'graded',
	[PlanStage.Implemented]: 'implemented',
};
