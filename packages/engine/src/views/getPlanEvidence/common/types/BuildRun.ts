import type { RunSummary } from '#src/common/types/RunSummary.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';

/** One run of a plan's build family, with the summary and run folder each section reads. */
export interface BuildRun {
	manifest: RunManifest;
	summary: RunSummary;
	/** Absolute, as `resolveRunDir` answered it. */
	runDir: string;
}
