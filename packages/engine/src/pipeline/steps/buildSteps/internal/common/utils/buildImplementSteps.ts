import { buildFeatureExecutorInvocation } from '#src/agents/buildFeatureExecutorInvocation.ts';
import { listSharedCode } from '#src/common/sharedCode/listSharedCode.ts';
import type { PlanBuildMode } from '#src/common/types/PlanBuildMode.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { PipelineStep } from '#src/pipeline/internal/PipelineStep.ts';
import type { FixBuilder } from '#src/pipeline/internal/steps/common/types/FixBuilder.ts';
import { formatStep } from '#src/pipeline/internal/steps/formatStep.ts';
import { workStep } from '#src/pipeline/internal/steps/workStep.ts';
import { verifyStep } from '#src/pipeline/steps/verifyStep/verifyStep.ts';

interface Params {
	run: PipelineRun;
	gitPrefix?: string;
	planContent: string;
	overviewContent?: string;
	standards?: string;
	fileLimit: number | undefined;
	/** Read at every call rather than captured once, so a re-invocation names the ledger rows as they now stand. */
	acceptanceTests: () => AcceptanceTestRecord[];
	/** The phase's build mode and the renames or moves it declares. */
	planBuildMode: PlanBuildMode;
	/** The same command the fix re-invocation carries, so the role's cached system prompt stays one. */
	selfCheckCommand: string;
	/** The files the plan names, which is where the implementing agent is about to work. */
	planFiles: string[];
	buildFix: FixBuilder;
}

export const buildImplementSteps = ({
	run,
	gitPrefix,
	planContent,
	overviewContent,
	standards,
	fileLimit,
	acceptanceTests,
	planBuildMode,
	selfCheckCommand,
	planFiles,
	buildFix,
}: Params): PipelineStep[] => [
	{
		id: 'implement',
		run: workStep({
			run,
			gitPrefix,
			id: 'implement',
			requireChanges: true,
			build: async () =>
				buildFeatureExecutorInvocation({
					planContent,
					overviewContent,
					standards,
					allowedCommands: run.config['agent-commands'],
					fileLimit,
					acceptanceTests: acceptanceTests(),
					selfCheckCommand,
					planBuildMode,
					sharedCode: await listSharedCode({ cwd: run.cwd, config: run.config, workFiles: planFiles }),
				}),
		}),
	},
	formatStep({ run, id: 'format-implement' }),
	{
		id: 'verify-implement',
		run: verifyStep({
			run,
			gitPrefix,
			planContent,
			overviewContent,
			id: 'verify-implement',
			acceptanceTests,
			planBuildMode,
			buildFix,
		}),
	},
];
