import { getRequiredFlag } from '#src/cli/common/args/getRequiredFlag.ts';
import { resolveTypedRunId } from '#src/cli/common/resolveTypedRunId/resolveTypedRunId.ts';
import { StopProcessOutcome } from '#src/cli/stopCommand/common/constants/StopProcessOutcome.ts';
import { stopProcess } from '#src/cli/stopCommand/stopProcess.ts';
import { exitCli } from '#src/common/exitCli.ts';
import { messageOf } from '#src/common/messageOf.ts';
import { readProcessStartTime } from '#src/common/processes/readProcessStartTime.ts';
import { formatResumeCommand } from '#src/common/runs/formatResumeCommand.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { isPidAlive } from '#src/runState/liveness/isPidAlive.ts';
import { readRunLock } from '#src/runState/lock/readRunLock.ts';
import { readRunProcessLock } from '#src/runState/lock/readRunProcessLock.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { getRunProgress } from '#src/views/getRunProgress.ts';

const StopTargetKind = {
	Nothing: 'nothing',
	QueueWorker: 'queue-worker',
	Mismatch: 'mismatch',
	Process: 'process',
} as const;

/** What stands behind a run's family root, and so what stop does about it. */
type StopTarget =
	| { kind: typeof StopTargetKind.Nothing }
	| { kind: typeof StopTargetKind.QueueWorker; queueRunId: string }
	| { kind: typeof StopTargetKind.Mismatch; pid: number }
	| { kind: typeof StopTargetKind.Process; pid: number; processStartTime?: string };

/** A phase child's coordinator is its family root, and the root is what holds the owner record. */
const readFamilyRoot = async ({ cwd, runId }: { cwd: string; runId: string }) => {
	try {
		const manifest = await readRunManifest({ cwd, runId });

		return { root: manifest.parentRunId === undefined ? manifest : await readRunManifest({ cwd, runId: manifest.parentRunId }) };
	} catch (error) {
		return { error: messageOf({ error }) };
	}
};

const readManifestOrUndefined = ({ cwd, runId }: { cwd: string; runId: string }) => readRunManifest({ cwd, runId }).catch(() => undefined);

/**
 * A pid that cannot be confirmed by its start time may have been reused, so it
 * is signalled only while the run it was recorded for could still be working.
 */
const isStillGoing = async ({ cwd, root }: { cwd: string; root: RunManifest }) =>
	root.status === RunStatus.Running || root.status === RunStatus.Pending || (await getRunProgress({ cwd, manifest: root, live: false })).awaitingShip;

const findOwnerTarget = async ({
	cwd,
	root,
	pid,
	processStartTime,
}: {
	cwd: string;
	root: RunManifest;
	pid: number;
	processStartTime?: string;
}): Promise<StopTarget> => {
	if (!isPidAlive({ pid })) {
		return { kind: StopTargetKind.Nothing };
	}

	// Read again immediately before signalling, so the check is as close to the signal as it can be.
	const liveStartTime = await readProcessStartTime({ pid });
	let target: StopTarget = { kind: StopTargetKind.Process, pid, processStartTime };

	if (processStartTime !== undefined && liveStartTime !== undefined && processStartTime !== liveStartTime) {
		target = { kind: StopTargetKind.Mismatch, pid };
	} else if ((processStartTime === undefined || liveStartTime === undefined) && !(await isStillGoing({ cwd, root }))) {
		target = { kind: StopTargetKind.Nothing };
	}

	return target;
};

/**
 * A pre-change phased run holds the lock under its moving child's id inside
 * the coordinator's own process, so a child of the root is a family match too.
 */
const isFamilyRun = async ({ cwd, root, runId }: { cwd: string; root: RunManifest; runId: string }) =>
	runId === root.runId || (await readManifestOrUndefined({ cwd, runId }))?.parentRunId === root.runId;

/** A pre-change queue worker runs inside the queue's process, which then also holds the launching checkout's lock under the queue run. */
const findHoldingQueue = async ({ cwd, pid }: { cwd: string; pid: number }) => {
	const checkoutLock = await readRunLock({ cwd });
	const holdsIt = checkoutLock !== undefined && checkoutLock.pid === pid && isPidAlive({ pid });
	const holder = holdsIt ? await readManifestOrUndefined({ cwd, runId: checkoutLock.runId }) : undefined;

	return holder?.pipeline === PipelineKind.Queue ? holder.runId : undefined;
};

/** A run started before owner records existed is found through the lock, which is per checkout and so read in the run's own workspace. */
const findLockTarget = async ({ cwd, root }: { cwd: string; root: RunManifest }): Promise<StopTarget> => {
	const lock = await readRunProcessLock({ cwd, manifest: root });

	if (lock === undefined || !isPidAlive({ pid: lock.pid }) || !(await isFamilyRun({ cwd, root, runId: lock.runId }))) {
		return { kind: StopTargetKind.Nothing };
	}

	const queueRunId = await findHoldingQueue({ cwd, pid: lock.pid });
	let target: StopTarget = { kind: StopTargetKind.Process, pid: lock.pid };

	if (queueRunId !== undefined) {
		target = { kind: StopTargetKind.QueueWorker, queueRunId };
	} else if (!(await isStillGoing({ cwd, root }))) {
		target = { kind: StopTargetKind.Nothing };
	}

	return target;
};

const findStopTarget = async ({ cwd, root }: { cwd: string; root: RunManifest }): Promise<StopTarget> => {
	const owner = await readRunOwner({ cwd, runId: root.runId });

	if (owner === undefined) {
		return findLockTarget({ cwd, root });
	}

	return 'queueRunId' in owner
		? { kind: StopTargetKind.QueueWorker, queueRunId: owner.queueRunId }
		: findOwnerTarget({ cwd, root, pid: owner.pid, processStartTime: owner.processStartTime });
};

const reportOutcome = ({ root, pid, outcome }: { root: RunManifest; pid: number; outcome: StopProcessOutcome }) => {
	const resumeCommand = formatResumeCommand({ pipeline: root.pipeline ?? PipelineKind.Implement, runId: root.runId });
	const messages: Record<StopProcessOutcome, () => void> = {
		[StopProcessOutcome.Exited]: () => console.log(`run ${root.runId} stopped. Resume it with: ${resumeCommand}`),
		[StopProcessOutcome.Killed]: () =>
			console.error(
				`run ${root.runId}: the engine did not shut down within ten seconds and had to be killed outright, so the run's agent process groups may remain. Make sure no agent is still working in the run's worktree before resuming it.`,
			),
		[StopProcessOutcome.Survived]: () => console.error(`run ${root.runId}: pid ${pid} is still alive after SIGKILL.`),
		[StopProcessOutcome.Refused]: () => console.error(`run ${root.runId}: the system refused to signal pid ${pid}, so it was left alone.`),
	};

	messages[outcome]();

	return exitCli({ code: outcome === StopProcessOutcome.Exited ? 0 : 1 });
};

const stopTarget = async ({ root, target }: { root: RunManifest; target: Extract<StopTarget, { kind: typeof StopTargetKind.Process }> }) => {
	const stopped = await stopProcess({ pid: target.pid, processStartTime: target.processStartTime }).catch((error: unknown) => ({
		error: messageOf({ error }),
	}));

	if (typeof stopped === 'object') {
		console.error(`stop: ${stopped.error}`);
		return exitCli({ code: 1 });
	}

	return reportOutcome({ root, pid: target.pid, outcome: stopped });
};

const actOnTarget = ({ root, target }: { root: RunManifest; target: StopTarget }) => {
	if (target.kind === StopTargetKind.Process) {
		return stopTarget({ root, target });
	}

	if (target.kind === StopTargetKind.QueueWorker) {
		console.error(
			`run ${root.runId} is a queue worker's run, which lives inside the queue's process — stop its queue instead: lightsout stop --run ${target.queueRunId}`,
		);
	} else if (target.kind === StopTargetKind.Mismatch) {
		console.error(`run ${root.runId}: pid ${target.pid} now belongs to a different process, so it was left alone.`);
	} else {
		console.log(`run ${root.runId}: no live process stands behind it, so there is nothing to stop.`);
	}

	return exitCli({ code: target.kind === StopTargetKind.Nothing ? 0 : 1 });
};

/**
 * Never writes a manifest, an owner record or the run lock, so a stopped run
 * stays resumable exactly as a crash would leave it. It reads the owner record
 * itself rather than asking `readRunLiveness`, because it needs the pid to
 * signal and must tell a gone pid, a reused pid and the engine's own pid apart.
 */
export const stopCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	// Detached spawning makes no new session there and SIGTERM is TerminateProcess,
	// so the engine's shutdown relay never runs and a "clean" stop would orphan its agents.
	if (process.platform === 'win32') {
		console.error('lightsout stop needs a POSIX system (macOS or Linux).');
		return exitCli({ code: 1 });
	}

	const typedRunId = await getRequiredFlag({ flags, name: 'run' });
	const runId = await resolveTypedRunId({ cwd, runId: typedRunId });
	const family = await readFamilyRoot({ cwd, runId });

	if ('error' in family) {
		console.error(`stop: ${family.error}`);
		return exitCli({ code: 1 });
	}

	const target = await findStopTarget({ cwd, root: family.root });

	return actOnTarget({ root: family.root, target });
};
