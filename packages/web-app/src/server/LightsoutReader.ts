import type { ConfigView, FrictionRecord, PlanDocument, PlanWorkspaceListing, PlanWorkspaceView, RunListing, RunView, StandardsView } from '@lightsout/engine';

/**
 * The seam a hosted version replaces. What the public pages show ships with the
 * app and is read directly, and the repo root is app configuration rather than
 * run data, so neither is a method here.
 */
export interface LightsoutReader {
	listRuns(): Promise<RunListing[]>;
	getRun(params: { runId: string }): Promise<RunView>;
	getStandards(): Promise<StandardsView>;
	getPlan(params: { path: string }): Promise<PlanDocument>;
	getFriction(): Promise<FrictionRecord[]>;
	getConfig(): Promise<ConfigView>;
	listPlanWorkspaces(): Promise<PlanWorkspaceListing[]>;
	getPlanWorkspace(params: { name: string }): Promise<PlanWorkspaceView>;
}
