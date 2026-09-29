import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { RunUsage } from '#src/contracts/run/RunUsage.ts';
import { writeRunManifest } from '#src/runState/writeRunManifest.ts';

interface Params {
	cwd: string;
	manifest: RunManifest;
	patch?: Partial<RunManifest>;
	/** The run's live usage aggregate — stamped into the manifest once any invocation has landed. */
	usageTotals: RunUsage;
}

/**
 * The one write path both pipelines share. Until the first invocation lands,
 * the manifest's existing usage is preserved rather than zeroed.
 */
export const writeManifestWithUsage = async ({ cwd, manifest, patch, usageTotals }: Params): Promise<RunManifest> => {
	const usage = usageTotals.invocations > 0 ? { ...usageTotals } : manifest.usage;

	return writeRunManifest({ cwd, manifest: { ...manifest, ...patch, usage } });
};
