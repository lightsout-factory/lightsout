import type ts from 'typescript';
import { formatResumeCommand } from '#src/common/formatResumeCommand.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { runCoverageBatch } from '#src/coverage/batch/runCoverageBatch/runCoverageBatch.ts';
import type { CoverageResult } from '#src/coverage/CoverageResult.ts';
import { runCoverageCheck } from '#src/coverage/common/runCoverageCheck.ts';
import type { CoverageBatch } from '#src/coverage/common/types/CoverageBatch.ts';
import type { CoverageRun } from '#src/coverage/runCoveragePipeline/common/CoverageRun.ts';
import type { seedCoverageResumeState } from '#src/coverage/runCoveragePipeline/common/seedCoverageResumeState.ts';
import { settleCoverageBatch } from '#src/coverage/runCoveragePipeline/runCoverageRounds/settleCoverageBatch.ts';
import { buildCoverageRound } from '#src/coverage/runCoverageRounds/buildCoverageRound/buildCoverageRound.ts';

const runRoundBatch = async ({
	run,
	driver,
	batch,
	testStandards,
	declineStreak,
	fileStrikes,
}: {
	run: CoverageRun;
	driver: Driver;
	batch: CoverageBatch;
	testStandards?: string;
	declineStreak: number;
	fileStrikes: Map<string, number>;
}) => {
	const prior = run.current().steps.find((step) => step.id === batch.id);
	const record: StepRecord = { id: batch.id, status: RunStatus.Running, attempts: (prior?.attempts ?? 0) + 1 };

	await run.setStep({ record });
	run.progress(`${batch.id} — ${batch.files.length} file(s) worst-covered, ${batch.members.length} in the writer's hands`);

	const outcome = await runCoverageBatch({
		cwd: run.cwd,
		runId: run.current().runId,
		driver,
		config: run.config,
		batch,
		testStandards,
		agentTimeoutMs: run.agentTimeoutMs,
		// The baseline dirt rides along: files dirty before the run started are
		// no batch's doing, however git sees the union.
		attributedFiles: [...run.current().changedFiles, ...run.current().baselineDirtyFiles],
		onProgress: (message) => run.progress(message),
		recordUsage: (entry) => run.recordUsage(entry),
	});

	return settleCoverageBatch({ run, batch, record, outcome, declineStreak, fileStrikes });
};

interface Params {
	run: CoverageRun;
	driver: Driver;
	batchInputs: {
		testStandards?: string;
		/** The consumer's TypeScript module, or undefined — without one, grouping degrades to one file per component. */
		compiler: typeof ts | undefined;
		/** Repo-relative standards-pack roots — what makes the test-file question answerable. */
		standardsLibraries: string[];
	};
	/** Stop (parked, resumable) after this many batches this run — budget control. */
	maxBatches?: number;
	resumed: Pick<ReturnType<typeof seedCoverageResumeState>, 'declineStreak' | 'batchCount' | 'fileStrikes'>;
}

/**
 * Rounds, not a frozen batch list: writing tests changes the numbers a
 * work-list would be built from, so every round re-measures.
 */
export const runCoverageRounds = async ({ run, driver, batchInputs, maxBatches, resumed }: Params): Promise<CoverageResult> => {
	const { testStandards, compiler, standardsLibraries } = batchInputs;
	let declineStreak = resumed.declineStreak;
	let batchCount = resumed.batchCount;
	let processed = 0;
	let result: CoverageResult | undefined;

	while (result === undefined) {
		const measured = await runCoverageCheck({
			cwd: run.cwd,
			config: run.config,
			runId: run.current().runId,
			step: 'measure',
			onProgress: (message) => run.progress(message),
		});

		// The consumer's own exit codes are the only done signal — the engine
		// never learns the threshold number.
		if (measured.passed) {
			await run.update({ patch: { status: RunStatus.Passed, currentStep: null } });
			run.progress('coverage gate green — nothing left to do');

			result = { ok: true, manifest: run.current(), setAside: run.setAside, before: run.before, after: measured.totals };
			continue;
		}

		if (maxBatches !== undefined && processed >= maxBatches) {
			const resume = `resume with: ${formatResumeCommand({ pipeline: PipelineKind.Coverage, runId: run.current().runId })}`;

			await run.update({ patch: { status: RunStatus.PausedBudget, currentStep: null } });
			run.progress(`budget ceiling (${maxBatches} batch(es)) reached — ${resume}`);

			result = run.buildHaltedResult({ error: `paused at --max-batches ${maxBatches} — ${resume}` });
			continue;
		}

		batchCount += 1;

		const round = await buildCoverageRound({ cwd: run.cwd, measured, setAside: run.setAside, standardsLibraries, compiler, batchNumber: batchCount });

		if ('error' in round) {
			await run.update({ patch: { status: RunStatus.Escalated, currentStep: null } });
			run.progress(`coverage run escalated — ${round.error}`);

			result = run.buildHaltedResult({ error: round.error });
			continue;
		}

		const settled = await runRoundBatch({ run, driver, batch: round.batch, testStandards, declineStreak, fileStrikes: resumed.fileStrikes });

		processed += 1;
		declineStreak = settled.declineStreak;
		result = settled.result;
	}

	return result;
};
