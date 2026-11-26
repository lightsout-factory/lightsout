import type { PlanWorkspaceView } from '@lightsout/engine';

/**
 * The seam a hosted version replaces. What the public pages show ships with the
 * app and is read directly, and the repo root is app configuration rather than
 * run data, so neither is a method here.
 */
export interface LightsoutReader {
	getPlanWorkspace(params: { name: string }): Promise<PlanWorkspaceView>;
}
