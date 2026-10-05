import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { exitCli } from '#src/common/exitCli.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { runDirectWork } from '#src/direct/runDirectWork/runDirectWork.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';

/** A resume must not re-derive the ticket: the one on disk may have been edited or deleted since the run froze this copy. */
const readFrozenTicket = ({ cwd, manifest }: { cwd: string; manifest: RunManifest }) => readFile(resolve(cwd, manifest.plan), 'utf8').catch(() => undefined);

interface Params {
	/** The checkout the command was launched from — where the run's records and its frozen ticket live. */
	cwd: string;
	/** The checkout the work happens in, as the run's manifest recorded it. */
	workspace: string;
	/** The run being continued, restamped with this invocation's ship intent. */
	manifest: RunManifest;
	config: LightsoutConfig;
	/** The run's recorded config and path. */
	loadedConfig: LoadedConfig;
	driver: Driver;
	/** Whether a passing run will ship, so a continued build records the same row a first one would. */
	willShip: boolean;
}

/**
 * Every status is handed back to the same pipeline, which decides from the
 * run's own `verify` step record whether anything is left to build, so a
 * resumed run and a first run cannot end differently.
 */
export const continueDirectRun = async ({ cwd, workspace, manifest, config, loadedConfig, driver, willShip }: Params): Promise<PipelineResult> => {
	const ticketBody = await readFrozenTicket({ cwd, manifest });

	if (ticketBody === undefined) {
		console.error(`ticket file not found: ${manifest.plan}`);
		return exitCli({ code: 1 });
	}

	return runDirectWork({
		cwd: workspace,
		ticketBody,
		ticketRef: manifest.ticketRef ?? manifest.branch ?? 'ticket',
		driver,
		driverName: manifest.harness,
		config,
		loadedConfig,
		existing: manifest,
		willShip,
		onProgress: createProgressPrinter(),
	});
};
