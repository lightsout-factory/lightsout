import { join } from 'node:path';
import { resolveNewRunDir } from '#src/common/resolveNewRunDir.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { createRun } from '#src/runState/createRun.ts';
import { seedUsageTotals } from '#src/runState/seedUsageTotals.ts';
import { writeManifestWithUsage } from '#src/runState/writeManifestWithUsage.ts';

interface Params {
	cwd: string;
	/** Pre-minted id — the drain takes the run lock under it before anything is written. */
	runId: string;
	/** Recorded on the manifest as the harness name. */
	driverName: string;
	/** The queue's startup config as it was read from disk, and its path, recorded on the coordinator's manifest. */
	loadedConfig: LoadedConfig;
}

// The directory is resolved before the run exists, because the manifest's `plan`
// field points at a `queue.md` inside it.
export const startCoordinatorRun = async ({
	cwd,
	runId,
	driverName,
	loadedConfig,
}: Params): Promise<{ coordinatorRunDir: string; planPath: string; manifest: RunManifest }> => {
	const coordinatorRunDir = await resolveNewRunDir({ cwd, pipeline: PipelineKind.Queue, runId });
	const planPath = join(coordinatorRunDir, 'queue.md');
	const manifest = await createRun({ cwd, runId, plan: planPath, pipeline: PipelineKind.Queue, driver: driverName, loadedConfig });

	await writeManifestWithUsage({ cwd, manifest, patch: { status: RunStatus.Running }, usageTotals: seedUsageTotals({ usage: manifest.usage }) });

	return { coordinatorRunDir, planPath, manifest };
};
