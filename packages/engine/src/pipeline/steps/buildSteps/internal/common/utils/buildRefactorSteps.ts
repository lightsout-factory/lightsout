import { buildRefactorExecutorInvocation } from '#src/agents/buildRefactorExecutorInvocation.ts';
import { RefactorScope } from '#src/common/constants/RefactorScope.ts';
import { buildSelfCheckCommand } from '#src/common/selfCheck/buildSelfCheckCommand.ts';
import { listSharedCode } from '#src/common/sharedCode/listSharedCode.ts';
import type { PlanBuildMode } from '#src/common/types/PlanBuildMode.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import { standardsScopeFiles } from '#src/pipeline/internal/common/utils/standardsScopeFiles.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { PipelineStep } from '#src/pipeline/internal/PipelineStep.ts';
import { formatStep } from '#src/pipeline/internal/steps/formatStep.ts';
import { refactorStep } from '#src/pipeline/steps/refactorStep/refactorStep.ts';
import { verifyStep } from '#src/pipeline/steps/verifyStep/verifyStep.ts';

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
						buildFix: async ({ errorContext }) =>
							buildRefactorExecutorInvocation({
								scope: RefactorScope.Feature,
								planContent,
								overviewContent,
								changedFiles: standardsScopeFiles({ run }),
								standards,
								errorContext,
								selfCheckCommand: buildSelfCheckCommand({ cwd: run.cwd, runId: run.current().runId }).command,
								sharedCode: await listSharedCode({ cwd: run.cwd, config: run.config, workFiles: standardsScopeFiles({ run }) }),
							}),
					}),
				},
			];
