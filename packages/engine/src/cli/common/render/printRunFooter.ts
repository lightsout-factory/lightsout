import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { isRunPaused } from '#src/runState/liveness/isRunPaused.ts';

interface Params {
	manifest: RunManifest;
	/** Why the run ended, when it did not simply finish. */
	ending?: string;
}

/**
 * A paused run's closing line goes to stdout: a run that stopped at
 * `--max-batches` did what it was asked, and stderr reads as a run that broke.
 */
export const printRunFooter = ({ manifest, ending }: Params): void => {
	if (manifest.changedFiles.length > 0) {
		console.log(`\n${manifest.changedFiles.length} file(s) changed in the working tree — review and commit; the engine never commits.`);
	}

	console.log(`evidence: .lightsout/runs/${manifest.runId}/`);

	if (ending === undefined) {
		return;
	}

	if (isRunPaused({ status: manifest.status })) {
		console.log(`\n${ending}`);
	} else {
		console.error(`\n${ending}`);
	}
};
