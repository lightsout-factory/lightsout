import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { printConfigSource } from '#src/cli/internal/common/render/printConfigSource.ts';
import { exitForRunResult } from '#src/cli/internal/common/utils/exitForRunResult.ts';
import { resolveCommandHarness } from '#src/cli/internal/common/utils/resolveCommandHarness.ts';
import { readLoadedConfig } from '#src/common/config/readLoadedConfig.ts';
import { readRunConfig } from '#src/common/config/readRunConfig.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { getDriver } from '#src/drivers/getDriver.ts';
import { RunLockError } from '#src/runState/lock/RunLockError.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';

interface BatchedRunResult {
	ok: boolean;
	manifest: RunManifest;
}

interface BatchedRunStart {
	/** Harness, model and effort already overwritten with this command's resolved values. */
	config: LightsoutConfig;
	/** The config to record on a fresh run, as it was read from disk before the command stamped its harness on it, and its path — which is also what a resumed run recorded. */
	loadedConfig: LoadedConfig;
	driver: Driver;
	maxBatches: number | undefined;
	/** The manifest of the run being resumed, or undefined for a fresh run. */
	existing: RunManifest | undefined;
}

interface Params<Result extends BatchedRunResult> {
	flags: CommandContext['flags'];
	cwd: string;
	/** Which lightsout command this is — selects its harness entry, and names it in the banner. */
	command: keyof NonNullable<LightsoutConfig['commands']>;
	run: (start: BatchedRunStart) => Promise<Result>;
	print: (params: { result: Result }) => void;
}

/** A fresh run reads the checkout's file; a resumed one continues on the config and path it recorded, and never reads the file. */
const loadConfig = async ({ cwd, existing }: { cwd: string; existing: RunManifest | undefined }): Promise<LoadedConfig | { error: string }> => {
	if (existing === undefined) {
		return readLoadedConfig({ cwd });
	}

	const recorded = readRunConfig({ manifest: existing });

	return 'error' in recorded ? recorded : { config: recorded.config, path: existing.configPath };
};

/**
 * These runs mutate the repo, so a missing config — meaning no gates — is a
 * hard error here, never the optional-config fallback `plan` and `improve` get.
 */
export const runBatchedCommand = async <Result extends BatchedRunResult>({ flags, cwd, command, run, print }: Params<Result>): Promise<void> => {
	const resumeRunId = getStringFlag({ flags, name: 'run' });
	const maxBatchesFlag = getStringFlag({ flags, name: 'max-batches' });
	const maxBatches = maxBatchesFlag === undefined ? undefined : Number.parseInt(maxBatchesFlag, 10);

	if (maxBatches !== undefined && (!Number.isFinite(maxBatches) || maxBatches < 1)) {
		console.error(`--max-batches must be a positive integer, got '${maxBatchesFlag}'`);
		return exitCli({ code: 1 });
	}

	let existing: RunManifest | undefined;

	try {
		existing = resumeRunId ? await readRunManifest({ cwd, runId: resumeRunId }) : undefined;
	} catch (error) {
		// An unknown id says which id; a manifest that will not parse says that
		// instead, rather than being reported as a run that does not exist.
		console.error(messageOf({ error }));
		return exitCli({ code: 1 });
	}

	const loaded = await loadConfig({ cwd, existing });

	if ('error' in loaded) {
		console.error(loaded.error);
		return exitCli({ code: 1 });
	}

	const { driverName, model, effort } = resolveCommandHarness({ config: loaded.config, command });
	const driver = getDriver({ name: driverName });
	const config = { ...loaded.config, harness: driverName, model, effort };

	console.log(`lightsout: ${command} ${existing ? `resuming run ${existing.runId}` : 'starting run'}`);

	// A resumed run that predates the recorded path has none to name, and printConfigSource
	// would read its absence as a checkout with no config file.
	if (loaded.path !== undefined) {
		printConfigSource({ configPath: loaded.path });
	}

	let result: Result;

	try {
		result = await run({ config, loadedConfig: loaded, driver, maxBatches, existing });
	} catch (error) {
		console.error(`\n${error instanceof RunLockError ? error.message : messageOf({ error })}`);
		return exitCli({ code: 1 });
	}

	print({ result });

	return exitForRunResult({ ok: result.ok, manifest: result.manifest });
};
