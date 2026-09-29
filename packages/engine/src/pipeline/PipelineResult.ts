import type { RunManifest } from '#src/contracts/run/RunManifest.ts';

export interface PipelineResult {
	ok: boolean;
	manifest: RunManifest;
	/** Present when ok is false. */
	error?: string;
}
