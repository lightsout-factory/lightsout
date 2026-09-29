import { getConfigView, getPlanDocument, getPlanWorkspace, getRunView, getStandardsView, listPlanWorkspaces, listRuns, readFriction } from '@lightsout/engine';
import type { LightsoutReader } from '#src/lightsout/common/types/LightsoutReader.ts';

interface ConstructorParams {
	/** Absolute path of the repo whose `.lightsout/` is read. */
	repoRoot: string;
}

/**
 * A class because every operation shares one injected dependency, and a second
 * implementation behind an HTTP call is the reason the interface exists.
 */
export class InProcessReader implements LightsoutReader {
	private readonly repoRoot: string;

	constructor({ repoRoot }: ConstructorParams) {
		this.repoRoot = repoRoot;
	}

	listRuns() {
		return listRuns({ cwd: this.repoRoot });
	}

	getRun({ runId }: { runId: string }) {
		return getRunView({ cwd: this.repoRoot, runId });
	}

	getStandards() {
		return getStandardsView({ cwd: this.repoRoot });
	}

	getPlan({ path }: { path: string }) {
		return getPlanDocument({ cwd: this.repoRoot, path });
	}

	getFriction() {
		return readFriction({ cwd: this.repoRoot });
	}

	getConfig() {
		return getConfigView({ cwd: this.repoRoot });
	}

	listPlanWorkspaces() {
		return listPlanWorkspaces({ cwd: this.repoRoot });
	}

	getPlanWorkspace({ name }: { name: string }) {
		return getPlanWorkspace({ cwd: this.repoRoot, name });
	}
}
