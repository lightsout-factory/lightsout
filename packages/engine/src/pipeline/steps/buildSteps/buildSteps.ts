import { BuildMode } from '#src/common/constants/BuildMode.ts';
import { buildSelfCheckCommand } from '#src/common/selfCheck/buildSelfCheckCommand.ts';
import type { PlanBuildMode } from '#src/common/types/PlanBuildMode.ts';
import { isTestSideFile } from '#src/pipeline/common/isTestSideFile.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import type { PipelineStep } from '#src/pipeline/common/types/PipelineStep.ts';
import { buildFeatureFix } from '#src/pipeline/steps/buildSteps/buildFeatureFix.ts';
import { buildImplementSteps } from '#src/pipeline/steps/buildSteps/buildImplementSteps/buildImplementSteps.ts';
import { buildLedgerLintSteps } from '#src/pipeline/steps/buildSteps/buildLedgerLintSteps.ts';
import { buildRefactorSteps } from '#src/pipeline/steps/buildSteps/buildRefactorSteps/buildRefactorSteps.ts';
import { buildTestSteps } from '#src/pipeline/steps/buildSteps/buildTestSteps/buildTestSteps.ts';
import { cleanSlateStep } from '#src/pipeline/steps/buildSteps/cleanSlateStep.ts';
import { getLedgerMovePaths } from '#src/pipeline/steps/buildSteps/getLedgerMovePaths.ts';
import { writeLedgerTestsStep } from '#src/pipeline/steps/buildSteps/writeLedgerTestsStep/writeLedgerTestsStep.ts';
import { parsePlan } from '#src/plan/parsePlan.ts';

interface Params {
	run: PipelineRun;
	gitPrefix?: string;
	planContent: string;
	overviewContent?: string;
	standards?: string;
	testStandards?: string;
	skipRefactor?: boolean;
}

const planBuildModeOf = ({
	buildMode,
	renames,
	movePaths,
	folderMoves,
}: Pick<ReturnType<typeof parsePlan>, 'buildMode' | 'renames' | 'movePaths' | 'folderMoves'>) => {
	let planBuildMode: PlanBuildMode = { buildMode: BuildMode.Standard };

	if (buildMode === BuildMode.RenamesOnly) {
		planBuildMode = { buildMode: BuildMode.RenamesOnly, renames };
	} else if (buildMode === BuildMode.MoveFoldersAndFiles) {
		planBuildMode = { buildMode: BuildMode.MoveFoldersAndFiles, fileMoves: movePaths, folderMoves };
	}

	return planBuildMode;
};

const ledgerSkipReason = ({ buildMode, ledgerRows }: { buildMode: BuildMode; ledgerRows: number }) => {
	let reason = ledgerRows === 0 ? 'the plan carries no acceptance-test ledger' : undefined;

	if (buildMode === BuildMode.RenamesOnly) {
		reason = 'the plan is rename-only, and a rename states no acceptance criterion a ledger test could prove';
	} else if (buildMode === BuildMode.MoveFoldersAndFiles) {
		reason = 'the plan is move-folders-and-files, and a move states no acceptance criterion a ledger test could prove';
	}

	return reason;
};

/**
 * A mechanical plan, rename-only (a `## Renames` section) or move-folders-and-files (a
 * `## Build Mode` section), runs no refactor steps: refactor edits are neither renames nor
 * path updates, so the mode's code check would refuse them.
 */
export const buildSteps = ({ run, gitPrefix, planContent, overviewContent, standards, testStandards, skipRefactor }: Params): PipelineStep[] => {
	// The plan's own file budget wins: one repo-wide setting cannot fit a phase that renames an
	// import across hundreds of files without weakening the guardrail for every other plan.
	const plan = parsePlan({ content: planContent, base: 'plan.md' });
	const fileLimit = plan.fileBudget ?? run.config['executor-file-limit'];
	// Read at every call: the ledger step seeds this mapping and an approved disposition rewrites it.
	const acceptanceTests = () => run.current().acceptanceTests;
	const ledgerGates = [...new Set(plan.ledger.map((row) => row.gate))];
	// A move destination the ledger writer writes carries every case its source
	// held, and a file the plan deletes is nowhere to put a named test.
	const movePaths = getLedgerMovePaths({ movePaths: plan.movePaths, folderMoves: plan.folderMoves, testFiles: plan.ledger.map((row) => row.testFile) });
	const deletePaths = plan.deletePaths.filter((path) => isTestSideFile({ path }));
	const planBuildMode = planBuildModeOf(plan);
	const mechanical = planBuildMode.buildMode !== BuildMode.Standard;
	// Built once and given to the implement step's own spawn AND to every fix
	// re-invocation of it: the two differ only in the user prompt, and a section
	// on one but not the other would split the role's cached system prompt in two.
	const selfCheckCommand = buildSelfCheckCommand({ cwd: run.cwd, runId: run.current().runId }).command;
	const featureFix = buildFeatureFix({ run, planContent, overviewContent, standards, fileLimit, acceptanceTests, planBuildMode, selfCheckCommand });
	const leaveOutRefactor = skipRefactor === true || mechanical;

	return [
		...buildLedgerLintSteps({ run, malformedLines: plan.malformedLedgerLines }),
		{ id: 'clean-slate', run: cleanSlateStep({ run, ledgerGates }) },
		{
			id: 'write-ledger-tests',
			skip: () => ledgerSkipReason({ buildMode: planBuildMode.buildMode, ledgerRows: plan.ledger.length }),
			run: writeLedgerTestsStep({ run, gitPrefix, planContent, overviewContent, rows: plan.ledger, testStandards, movePaths, deletePaths }),
		},
		...buildImplementSteps({
			run,
			gitPrefix,
			planContent,
			overviewContent,
			standards,
			fileLimit,
			acceptanceTests,
			planBuildMode,
			selfCheckCommand,
			buildFix: featureFix,
		}),
		...buildTestSteps({
			run,
			gitPrefix,
			planContent,
			overviewContent,
			testStandards,
			acceptanceTests,
			final: leaveOutRefactor,
			planBuildMode,
			featureFix,
		}),
		...buildRefactorSteps({
			run,
			gitPrefix,
			planContent,
			overviewContent,
			standards,
			skipRefactor: leaveOutRefactor,
			acceptanceTests,
			planBuildMode,
		}),
	];
};
