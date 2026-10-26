import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { resolveConsumerTypescript } from '#src/common/workspace/resolveConsumerTypescript.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import type { PipelineStep } from '#src/pipeline/common/types/PipelineStep.ts';
import { groupTestTargets } from '#src/pipeline/steps/buildSteps/buildTestSteps/writeTestsStep/groupTestTargets.ts';
import { selectTestTargets } from '#src/pipeline/steps/buildSteps/buildTestSteps/writeTestsStep/selectTestTargets.ts';
import { collectChanged } from '#src/pipeline/steps/common/collectChanged.ts';
import { testWriterConcurrency } from '#src/pipeline/steps/common/constants/testWriterConcurrency.ts';
import { sourceFiles } from '#src/pipeline/steps/common/sourceFiles.ts';
import { withStepFiles } from '#src/pipeline/steps/common/withStepFiles.ts';
import { runWriterBatches } from '#src/pipeline/steps/writeTestsStep/runWriterBatches/runWriterBatches.ts';

interface Params {
	run: PipelineRun;
	gitPrefix?: string;
	planContent: string;
	testStandards?: string;
}

const narrateSkippedFiles = ({ run, deleted, inert, uncoverable }: { run: PipelineRun; deleted: string[]; inert: string[]; uncoverable: string[] }) => {
	if (deleted.length > 0) {
		run.progress(`write-tests: ${deleted.length} deleted file(s) skipped (removed by the plan, nothing to cover): ${deleted.join(', ')}`);
	}

	if (inert.length > 0) {
		run.progress(`write-tests: ${inert.length} inert file(s) skipped (no runtime code, nothing to cover): ${inert.join(', ')}`);
	}

	if (uncoverable.length > 0) {
		run.progress(
			`write-tests: ${uncoverable.length} file(s) skipped — no unit test could move their coverage (a tool's own settings file, a module-scope await this repo's Jest loads as CommonJS, or a path this repo's coverage configuration does not collect): ${uncoverable.join(', ')}`,
		);
	}
};

export const writeTestsStep = ({ run, gitPrefix, planContent, testStandards }: Params): PipelineStep['run'] => {
	return async () => {
		let record = run.nextRecord({ id: 'write-tests' });

		await run.setStep({ record });

		const packagesDir = run.config['packages-dir'] ?? defaultPackagesDir;
		const compiler = resolveConsumerTypescript({ cwd: run.cwd, packagesDir });
		const { targets, inert, uncoverable, deleted, coverageExcluded } = await selectTestTargets({
			run,
			candidates: sourceFiles({ run }),
			compiler,
			packagesDir,
		});

		narrateSkippedFiles({ run, deleted, inert, uncoverable });

		// Persisted before any writer spawns — a crash mid-fan-out must not lose
		// the skip record a verify fix re-invocation reads back.
		await run.setStep({ record, patch: { coverageExcludedChangedFiles: coverageExcluded } });

		const groups = await groupTestTargets({ run, targets, compiler });

		run.progress(
			`step write-tests — attempt ${record.attempts} · ${groups.length} group(s) covering ${targets.length} changed file(s), up to ${testWriterConcurrency} writers in parallel`,
		);
		const { reports, failures, terminated, parked } = await runWriterBatches({
			run,
			groups,
			planContent,
			testStandards,
			acceptanceTests: run.current().acceptanceTests,
		});

		// Persist whatever progress the batches made before deciding the
		// outcome — a parked or stopped run must still know what was touched.
		record = withStepFiles({ record, reports, gitPrefix });

		await run.setStep({
			record: { ...record, report: { reports } },
			patch: {
				...(await collectChanged({ run, gitPrefix, reports })),
				coverageExcludedChangedFiles: coverageExcluded,
			},
		});

		if (parked) {
			return run.stop({ record: { ...record, report: { reports } }, status: RunStatus.PausedRateLimit, error: run.parkMessage() });
		}

		if (failures.length > 0) {
			return run.stop({
				record: { ...record, report: { reports } },
				status: terminated ? RunStatus.Escalated : RunStatus.Failed,
				error: `write-tests: ${failures.length} of ${groups.length} writer(s) did not complete:\n${failures.join('\n')}`,
			});
		}

		await run.setStep({ record: { ...record, status: RunStatus.Passed, report: { reports } } });
		run.progress('step write-tests passed');

		return undefined;
	};
};
