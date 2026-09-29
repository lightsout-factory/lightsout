import type { CoverageBatchReport } from '#src/contracts/coverage/CoverageBatchReport.ts';
import { maxFileStrikes } from '#src/coverage/internal/common/constants/maxFileStrikes.ts';
import type { CoverageSetAside } from '#src/coverage/internal/common/types/CoverageSetAside.ts';

interface Params {
	/** The batch whose report is being folded in — the id a new set-aside entry cites. */
	batchId: string;
	files: CoverageBatchReport['files'];
	/** The run's per-file strike counts, updated in place. */
	fileStrikes: Map<string, number>;
}

/**
 * The free-rider guard: a hard file can ride along in improving batches forever
 * without tripping the batch-level decline rule. The live run and a resumed
 * run's replay both use this, so they never disagree about which files a human
 * already owns.
 */
export const updateFileStrikes = ({ batchId, files, fileStrikes }: Params): CoverageSetAside[] => {
	const setAside: CoverageSetAside[] = [];

	for (const file of files) {
		if (file.afterPct > file.beforePct) {
			fileStrikes.set(file.path, 0);
			continue;
		}

		const strikes = (fileStrikes.get(file.path) ?? 0) + 1;

		fileStrikes.set(file.path, strikes);

		if (strikes === maxFileStrikes) {
			setAside.push({ batchId, files: [file.path], rationale: [`no improvement across ${maxFileStrikes} batches — likely needs source changes`] });
		}
	}

	return setAside;
};
