import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import { usage } from '#src/cli/common/constants/usage.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { loadPlanningProgressBlock } from '#src/cli/internal/common/progressBlock/loadPlanningProgressBlock.ts';
import { loadShippingProgressBlock } from '#src/cli/internal/common/progressBlock/loadShippingProgressBlock.ts';
import { printQueueStatus } from '#src/cli/internal/common/queueBoard/printQueueStatus.ts';
import { printRunProgress } from '#src/cli/internal/common/render/printRunProgress.ts';
import { printAmbiguousRuns } from '#src/cli/internal/common/runStatus/printAmbiguousRuns.ts';
import { printGoingRunStatus } from '#src/cli/internal/common/runStatus/printGoingRunStatus.ts';
import { printNewestRun } from '#src/cli/internal/common/runStatus/printNewestRun.ts';
import { printRunFinalReport } from '#src/cli/internal/common/runStatus/printRunFinalReport.ts';
import { resolveTypedRunId } from '#src/cli/internal/common/utils/resolveTypedRunId.ts';
import { resolveWatchTarget } from '#src/cli/internal/common/utils/resolveWatchTarget.ts';
import { watchRunProgress } from '#src/cli/internal/common/utils/watchRunProgress.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { listRunIds } from '#src/runState/listRunIds.ts';
import { readRunLiveness } from '#src/runState/readRunLiveness.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';

// Scripts read this listing, so its format must not change.
const printRunListing = async ({ cwd }: { cwd: string }) => {
	const runIds = await listRunIds({ cwd });

	if (runIds.length === 0) {
		console.log('no runs found');
		return;
	}

	for (const runId of runIds) {
		const manifest = await readRunManifest({ cwd, runId }).catch(() => undefined);

		if (manifest) {
			const { live } = await readRunLiveness({ cwd, manifest });
			// A `running` manifest with no live process is a crash leftover: resumable, not lost.
			const zombie = manifest.status === RunStatus.Running && !live;
			const status = zombie ? `${manifest.status} (no live process — crashed? resume with --run ${manifest.runId})` : manifest.status;
			const phases =
				manifest.pipeline === PipelineKind.Phases
					? `  phases: ${manifest.steps.filter((step) => step.status === RunStatus.Passed).length}/${manifest.steps.length}`
					: '';

			// So a queue's parked work is findable from the run list alone.
			const ticket = manifest.ticketRef === undefined ? '' : `  ticket: ${manifest.ticketRef}`;

			console.log(`${manifest.runId}  ${status}  plan: ${manifest.plan}${ticket}${phases}  updated: ${manifest.updatedAt}`);
		}
	}
};

const printPlanningStatus = async ({ cwd, flags }: { cwd: string; flags: Map<string, string | true> }) => {
	const name = getStringFlag({ flags, name: 'planning' });

	if (name === undefined || flags.has('run') || flags.has('watch')) {
		console.error(usage);
		return exitCli({ code: 1 });
	}

	console.log('');

	for (const line of await loadPlanningProgressBlock({ cwd, name })) {
		console.log(line);
	}

	return exitCli({ code: 0 });
};

const printShippingStatus = async ({ cwd, flags }: { cwd: string; flags: Map<string, string | true> }) => {
	const branch = getStringFlag({ flags, name: 'shipping' });

	if (branch === undefined || flags.has('run') || flags.has('watch') || flags.has('planning')) {
		console.error(usage);
		return exitCli({ code: 1 });
	}

	console.log('');

	for (const line of await loadShippingProgressBlock({ cwd, branch })) {
		console.log(line);
	}

	return exitCli({ code: 0 });
};

const printQueueForm = async ({ cwd, flags }: { cwd: string; flags: Map<string, string | true> }) => {
	const valued = flags.get('queue') !== true || (flags.has('wait') && flags.get('wait') !== true);
	const clash = flags.has('watch') || flags.has('planning') || flags.has('shipping') || flags.has('now');

	if (valued || clash) {
		console.error(usage);
		return exitCli({ code: 1 });
	}

	const runFlag = getStringFlag({ flags, name: 'run' });
	const runId = runFlag === undefined ? undefined : await resolveTypedRunId({ cwd, runId: runFlag });
	// Undefined rather than false when it was not typed, so the resolver is asked
	// only what the reader asked for.
	const wait = flags.has('wait') ? true : undefined;

	return exitCli({ code: await printQueueStatus({ cwd, runId, wait }) });
};

/**
 * Several unrelated runs going at once are named back to the reader rather than
 * guessed between, because narrating somebody else's concurrent work is worse
 * than asking which one they meant.
 */
export const statusCommand = async ({ cwd, flags }: CommandContext): Promise<void> => {
	const runFlag = getStringFlag({ flags, name: 'run' });
	const watch = flags.get('watch') === true;

	// --wait waits for a queue run to take the lock, which no other form looks for.
	if (flags.has('wait') && !flags.has('queue')) {
		console.error(usage);
		return exitCli({ code: 1 });
	}

	if (flags.has('queue')) {
		return printQueueForm({ cwd, flags });
	}

	if (flags.has('now')) {
		return exitCli({ code: await printGoingRunStatus({ cwd, flags }) });
	}

	if (flags.has('shipping')) {
		return printShippingStatus({ cwd, flags });
	}

	if (flags.has('planning')) {
		return printPlanningStatus({ cwd, flags });
	}

	if (runFlag === undefined && !watch) {
		await printRunListing({ cwd });
		return exitCli({ code: 0 });
	}

	if (runFlag !== undefined) {
		const runId = await resolveTypedRunId({ cwd, runId: runFlag });

		if (watch) {
			await watchRunProgress({ cwd, runId });
		} else {
			await printRunProgress({ cwd, runId });
			await printRunFinalReport({ cwd, runId });
		}

		return exitCli({ code: 0 });
	}

	// The one call that spends the full grace period, waiting for a just-started
	// run to write its first manifest.
	const going = await resolveWatchTarget({ cwd });

	if (going !== undefined && 'ambiguous' in going) {
		printAmbiguousRuns({ roots: going.ambiguous });

		return exitCli({ code: 1 });
	}

	await (going === undefined ? printNewestRun({ cwd }) : watchRunProgress({ cwd, runId: going.rootRunId }));

	return exitCli({ code: 0 });
};
