import { buildRefactorExecutorInvocation } from '#src/agents/buildRefactorExecutorInvocation.ts';
import { RefactorScope } from '#src/common/constants/RefactorScope.ts';
import { buildSelfCheckCommand } from '#src/common/selfCheck/buildSelfCheckCommand.ts';
import type { PlanBuildMode } from '#src/common/types/PlanBuildMode.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import type { PipelineStep } from '#src/pipeline/common/types/PipelineStep.ts';
import { refactorStep } from '#src/pipeline/steps/buildSteps/buildRefactorSteps/refactorStep/refactorStep.ts';
import { formatStep } from '#src/pipeline/steps/buildSteps/common/formatStep.ts';
import { verifyStep } from '#src/pipeline/steps/buildSteps/common/verifyStep.ts';
import { standardsScopeFiles } from '#src/pipeline/steps/common/standardsScopeFiles.ts';

interface Params {
	run: PipelineRun;
	gitPrefix?: string;
	planContent: string;
	overviewContent?: string;
	standards?: string;
	skipRefactor?: boolean;
	/** Read at every call rather than captured once, so a re-invocation names the ledger rows as they now stand. */
	acceptanceTests: () => AcceptanceTestRecord[];
	planBuildMode: PlanBuildMode;
}

/**
 * Scoped on `standardsScopeFiles` rather than `sourceFiles`: the gate judges findings on test
 * files too, so a run that changed only tests still has standards to answer for.
 */
export const buildRefactorSteps = ({
	run,
	gitPrefix,
	planContent,
	overviewContent,
	standards,
	skipRefactor,
	acceptanceTests,
	planBuildMode,
}: Params): PipelineStep[] =>
	skipRefactor
		? []
		: [
				{
					id: 'refactor',
					skip: () => (standardsScopeFiles({ run }).length === 0 ? 'no changed source files to review' : undefined),
					run: refactorStep({ run, gitPrefix, planContent, overviewContent, standards }),
				},
				formatStep({ run, id: 'format-refactor' }),
				{
					id: 'verify-refactor',
					run: verifyStep({
						run,
						gitPrefix,
						planContent,
						overviewContent,
						id: 'verify-refactor',
						coverage: true,
						acceptanceTests,
						// Where the refactor steps run at all, this is the run's last
						// verification — and the last one is where every acceptance test
						// must be proven against the finished tree.
						final: true,
						planBuildMode,
						buildFix: ({ errorContext }) =>
							buildRefactorExecutorInvocation({
								scope: RefactorScope.Feature,
								planContent,
								overviewContent,
								changedFiles: standardsScopeFiles({ run }),
								standards,
								errorContext,
								selfCheckCommand: buildSelfCheckCommand({ cwd: run.cwd, runId: run.current().runId }).command,
							}),
					}),
				},
			];
