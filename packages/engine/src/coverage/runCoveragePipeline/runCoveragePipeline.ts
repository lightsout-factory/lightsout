import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { runPreflightGate } from '#src/common/runPreflightGate.ts';
import { listSourceFiles } from '#src/common/sourceFiles/listSourceFiles.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import { resolveConsumerTypescript } from '#src/common/workspace/resolveConsumerTypescript.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { CoverageResult } from '#src/coverage/CoverageResult.ts';
import { CoverageRun } from '#src/coverage/runCoveragePipeline/common/CoverageRun.ts';
import { seedCoverageResumeState } from '#src/coverage/runCoveragePipeline/common/seedCoverageResumeState.ts';
import { initializeCoverageRun } from '#src/coverage/runCoveragePipeline/initializeCoverageRun.ts';
import { runCoverageRounds } from '#src/coverage/runCoveragePipeline/runCoverageRounds/runCoverageRounds.ts';
import { withRunLock } from '#src/runState/lock/withRunLock/withRunLock.ts';
import { resolveStandards } from '#src/standards/resolveStandards.ts';

interface Params {
	cwd: string;
	driver: Driver;
	config: LightsoutConfig;
	/** The config as it was read from disk, before the command stamped its harness on it, and its path, recorded on a fresh run. */
	loadedConfig: LoadedConfig;
	/** Stop (parked, resumable) after this many batches — budget control. */
	maxBatches?: number;
	/** Accept a dirty tree: the standing dirt is recorded as baseline, never attributed to a batch. */
	allowDirty?: boolean;
	/** Resume: an existing manifest — set-aside files, streak, and numbering reseed from its steps. */
	existing?: RunManifest;
	onProgress?: (message: string) => void;
}

/**
 * Every state transition persists before the next action. Rate limits and the
 * budget ceiling park; three consecutive declines stop the run as systemic. The
 * engine never commits: the run ends with tests in the working tree.
 */
const executeCoverage = async ({
	cwd,
	runId,
	driver,
	config,
	loadedConfig,
	maxBatches,
	allowDirty,
	existing,
	onProgress,
}: Params & { runId: string }): Promise<CoverageResult> => {
	const { manifest, worklist } = await initializeCoverageRun({ cwd, runId, driver, config, loadedConfig, allowDirty, existing });
	// Rebuilt from persisted batch reports, never process memory, so the state
	// survives park and resume.
	const seeded = seedCoverageResumeState({ manifest });
	const run = new CoverageRun({ cwd, config, manifest, onProgress, setAside: seeded.setAside, before: worklist.totals });

	await run.update({ patch: { status: RunStatus.Running } });

	// Coverage is excluded from this run's pre-flight: its coverage gate is red
	// by definition here, but a red check or unit suite must not be blamed on a
	// batch.
	const redBaseline = await runPreflightGate({
		run,
		coverage: false,
		label: 'pre-flight — types and unit tests before any batch',
		redBaselineError: 'Codebase is not green before raising coverage — fix this first.',
	});

	if (redBaseline) {
		return redBaseline;
	}

	const { testStandards } = await resolveStandards({ cwd, config });
	// Resolved once for the run: without a consumer TypeScript, grouping degrades
	// to one file per batch component, exactly like the implement fan-out.
	const compiler = resolveConsumerTypescript({ cwd, packagesDir: config['packages-dir'] ?? defaultPackagesDir });
	// Without the pack roots, a rule check under a pack's `tests/` document set
	// would be filtered out as a test everywhere.
	const { standardsLibraries } = await listSourceFiles({ cwd });

	return runCoverageRounds({ run, driver, batchInputs: { testStandards, compiler, standardsLibraries }, maxBatches, resumed: seeded });
};

/** Every pipeline takes the same repo lock, so no two runs can race one tree. */
export const runCoveragePipeline = (params: Params): Promise<CoverageResult> => withRunLock({ params, run: executeCoverage });
