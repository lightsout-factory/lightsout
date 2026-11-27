import { getPlanEvidence, getPlanWorkspace, getQueueView, getWorkOrderEvidence, getWorkOrderView, listWorkOrderSummaries } from '@lightsout/engine';
import type { LightsoutReader } from '#src/server/LightsoutReader.ts';

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

	listWorkOrderSummaries() {
		return listWorkOrderSummaries({ cwd: this.repoRoot });
	}

	getWorkOrderView({ name }: { name: string }) {
		return getWorkOrderView({ cwd: this.repoRoot, name });
	}

	getPlanWorkspace({ name }: { name: string }) {
		return getPlanWorkspace({ cwd: this.repoRoot, name });
	}

	getPlanEvidence({ name }: { name: string }) {
		return getPlanEvidence({ cwd: this.repoRoot, name });
	}

	getWorkOrderEvidence({ name }: { name: string }) {
		return getWorkOrderEvidence({ cwd: this.repoRoot, name });
	}

	getQueueView() {
		return getQueueView({ cwd: this.repoRoot });
	}
}
