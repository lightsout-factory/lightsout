import { createProgressPrinter } from '#src/cli/common/createProgressPrinter.ts';
import { runPhasesOrFailFast } from '#src/cli/common/runPhasesOrFailFast.ts';
import { runPipelineOrFailFast } from '#src/cli/common/runPipelineOrFailFast.ts';
import { continueDirectRun } from '#src/cli/resumeCommand/runResumedPipeline/continueDirectRun.ts';
import type { ActivityLevel } from '#src/common/types/ActivityLevel.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';

interface Params {
	pipeline: PipelineKind;
	cwd: string;
	workspace: string;
	driver: Driver;
	config: LightsoutConfig;
	/** The run's recorded config and recorded path, never the launching checkout's file. */
	loadedConfig: LoadedConfig;
	willShip: boolean;
	resumable: RunManifest;
	skipRefactor: boolean;
	/** The command-run level this continuation's work hangs from, or undefined when nothing is being recorded. */
	level: ActivityLevel | undefined;
}

export const runResumedPipeline = ({
	pipeline,
	cwd,
	workspace,
	driver,
	config,
	loadedConfig,
	willShip,
	resumable,
	skipRefactor,
	level,
}: Params): Promise<PipelineResult> => {
	if (pipeline === PipelineKind.Direct) {
		return continueDirectRun({ cwd, workspace, manifest: resumable, config, loadedConfig, driver, willShip });
	}

	const params = { cwd: workspace, driver, config, loadedConfig, existing: resumable, skipRefactor, level, onProgress: createProgressPrinter() };

	return pipeline === PipelineKind.Phases ? runPhasesOrFailFast(params) : runPipelineOrFailFast(params);
};
