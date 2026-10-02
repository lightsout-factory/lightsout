import { buildUnitTestWriterInvocation } from '#src/agents/buildUnitTestWriterInvocation.ts';
import { BuildMode } from '#src/common/constants/BuildMode.ts';
import type { PlanBuildMode } from '#src/common/types/PlanBuildMode.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import { sourceFiles } from '#src/pipeline/internal/common/utils/sourceFiles.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { PipelineStep } from '#src/pipeline/internal/PipelineStep.ts';
import type { FixBuilder } from '#src/pipeline/internal/steps/common/types/FixBuilder.ts';
import { formatStep } from '#src/pipeline/internal/steps/formatStep.ts';
import { writeTestsStep } from '#src/pipeline/internal/steps/writeTestsStep.ts';
import { verifyStep } from '#src/pipeline/steps/verifyStep/verifyStep.ts';

interface Params {
	run: PipelineRun;
	gitPrefix?: string;
	planContent: string;
	overviewContent?: string;
	testStandards?: string;
	/** Read at every call rather than captured once, so a re-invocation names the ledger rows as they now stand. */
	acceptanceTests: () => AcceptanceTestRecord[];
	/** True when the refactor steps are skipped, making this checkpoint the run's last verification. */
	final: boolean;
	/** The phase's build mode and the renames or moves it declares. */
	planBuildMode: PlanBuildMode;
	/** The feature executor's fix re-invocation, which repairs a rename-only or move-folders-and-files plan's verify-tests in place of the unit-test writer. */
	featureFix: FixBuilder;
}

export const buildTestSteps = ({
	run,
	gitPrefix,
	planContent,
	overviewContent,
	testStandards,
	acceptanceTests,
	final,
	planBuildMode,
	featureFix,
}: Params): PipelineStep[] => [
	{
		id: 'write-tests',
		skip: () => {
			if (planBuildMode.buildMode === BuildMode.RenamesOnly) {
				return 'the plan is rename-only, and a rename-only phase writes no tests';
			}

			if (planBuildMode.buildMode === BuildMode.MoveFoldersAndFiles) {
				return 'the plan is move-folders-and-files, and a move-folders-and-files phase writes no tests';
			}

			return sourceFiles({ run }).length === 0 ? 'no eligible source files' : undefined;
		},
		run: writeTestsStep({ run, gitPrefix, planContent, testStandards }),
	},
	formatStep({ run, id: 'format-tests' }),
	{
		id: 'verify-tests',
		run: verifyStep({
			run,
			gitPrefix,
			planContent,
			overviewContent,
			id: 'verify-tests',
			coverage: true,
			acceptanceTests,
			final,
			planBuildMode,
			buildFix:
				planBuildMode.buildMode !== BuildMode.Standard
					? featureFix
					: async ({ errorContext }) =>
							buildUnitTestWriterInvocation({
								planContent,
								subjects: run.current().testSubjects,
								mustExecute: sourceFiles({ run }).filter(
									(file) => !run.current().unreachableChangedFiles.includes(file) && !run.current().coverageExcludedChangedFiles.includes(file),
								),
								standards: testStandards,
								errorContext,
								acceptanceTests: acceptanceTests(),
							}),
		}),
	},
];
