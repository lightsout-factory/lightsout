import type { PlanWorkspaceView, QueueView, WorkOrderSummary, WorkOrderView } from '@lightsout/engine';

/**
 * The seam a hosted version replaces. What the public pages show ships with the
 * app and is read directly, and the repo root is app configuration rather than
 * run data, so neither is a method here.
 */
export interface LightsoutReader {
	listWorkOrderSummaries(): Promise<WorkOrderSummary[]>;
	/** Undefined when no work-order folder has that name. */
	getWorkOrderView(params: { name: string }): Promise<WorkOrderView | undefined>;
	getPlanWorkspace(params: { name: string }): Promise<PlanWorkspaceView>;
	getQueueView(): Promise<QueueView>;
}
