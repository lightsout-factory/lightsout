import { buildFeatureExecutorInvocation } from '#src/agents/buildFeatureExecutorInvocation.ts';
import { listSharedCode } from '#src/common/sharedCode/listSharedCode.ts';
import type { PlanBuildMode } from '#src/common/types/PlanBuildMode.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { FixBuilder } from '#src/pipeline/internal/steps/common/types/FixBuilder.ts';

interface Params {
	run: PipelineRun;
	planContent: string;
	overviewContent?: string;
	standards?: string;
	fileLimit: number | undefined;
	/** Read at every call rather than captured once. */
	acceptanceTests: () => AcceptanceTestRecord[];
	planBuildMode: PlanBuildMode;
	selfCheckCommand: string;
	/** The files the plan names. A repair also works in whatever the run has changed since. */
	planFiles: string[];
}

/**
 * A rename-only or move-folders-and-files plan's verify-tests also repairs through this,
 * because a unit-test writer must not repair a phase that writes no tests. It must receive the
 * same `selfCheckCommand` and `planBuildMode` as the implement spawn, or the role's cached
 * system prompt splits in two.
 */
export const buildFeatureFix =
	({ run, planContent, overviewContent, standards, fileLimit, acceptanceTests, planBuildMode, selfCheckCommand, planFiles }: Params): FixBuilder =>
	async ({ errorContext }) =>
		buildFeatureExecutorInvocation({
			planContent,
			overviewContent,
			standards,
			errorContext,
			changedFiles: run.current().changedFiles,
			allowedCommands: run.config['agent-commands'],
			fileLimit,
			acceptanceTests: acceptanceTests(),
			selfCheckCommand,
			planBuildMode,
			sharedCode: await listSharedCode({ cwd: run.cwd, config: run.config, workFiles: [...planFiles, ...run.current().changedFiles] }),
		});
