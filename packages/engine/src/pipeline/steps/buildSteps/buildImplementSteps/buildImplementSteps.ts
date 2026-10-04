import { buildFeatureExecutorInvocation } from '#src/agents/buildFeatureExecutorInvocation/buildFeatureExecutorInvocation.ts';
import type { PlanBuildMode } from '#src/common/types/PlanBuildMode.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import type { PipelineStep } from '#src/pipeline/common/types/PipelineStep.ts';
import { workStep } from '#src/pipeline/steps/buildSteps/buildImplementSteps/workStep/workStep.ts';
import { formatStep } from '#src/pipeline/steps/buildSteps/common/formatStep.ts';
import { verifyStep } from '#src/pipeline/steps/buildSteps/common/verifyStep/verifyStep.ts';
import type { FixBuilder } from '#src/pipeline/steps/common/types/FixBuilder.ts';

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
	buildFix,
}: Params): PipelineStep[] => [
	{
		id: 'implement',
		run: workStep({
			run,
			gitPrefix,
			id: 'implement',
			requireChanges: true,
			build: () =>
				buildFeatureExecutorInvocation({
					planContent,
					overviewContent,
					standards,
					allowedCommands: run.config['agent-commands'],
					fileLimit,
					acceptanceTests: acceptanceTests(),
					selfCheckCommand,
					planBuildMode,
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
