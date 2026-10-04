import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { usage } from '#src/cli/common/constants/usage.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { pausedExitCode } from '#src/cli/internal/common/constants/pausedExitCode.ts';
import { QueueBoardState } from '#src/cli/internal/common/constants/QueueBoardState.ts';
import { unusableTicketPatternMessage } from '#src/cli/internal/common/constants/unusableTicketPatternMessage.ts';
import { launchDetached } from '#src/cli/internal/common/detach/launchDetached.ts';
import { readLaunchRunId } from '#src/cli/internal/common/detach/readLaunchRunId.ts';
import { renderQueueBoard } from '#src/cli/internal/common/queueBoard/renderQueueBoard.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import { resolveEffectiveConfigAndDriver } from '#src/cli/internal/common/utils/resolveEffectiveConfigAndDriver.ts';
import { readLoadedConfig } from '#src/common/config/readLoadedConfig.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { QueueSummary } from '#src/contracts/queue/QueueSummary.ts';
import { toQueueBoardTickets } from '#src/queue/board/toQueueBoardTickets.ts';
import { writeQueueSummary } from '#src/queue/board/writeQueueSummary.ts';
import type { QuestionRelay } from '#src/queue/common/types/QuestionRelay.ts';
import type { QueueDrainReport } from '#src/queue/common/types/QueueDrainReport.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import { isParkedOutcome } from '#src/queue/common/utils/isParkedOutcome.ts';
import { emptyRelayMailbox } from '#src/queue/relay/emptyRelayMailbox.ts';
import { FileQuestionRelay } from '#src/queue/relay/FileQuestionRelay.ts';
import { TerminalQuestionRelay } from '#src/queue/relay/TerminalQuestionRelay.ts';
import { runQueue } from '#src/queue/runQueue.ts';
import { resolveQueueSettings } from '#src/queue/startup/resolveQueueSettings.ts';
import { isPidAlive } from '#src/runState/isPidAlive.ts';
import { readRunLock } from '#src/runState/lock/readRunLock.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';
import { resolveShipSettings } from '#src/ship/resolveShipSettings.ts';
import type { TrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';
import { resolveTrackerSettings } from '#src/ticketTracker/resolveTrackerSettings.ts';

/**
 * The `queue` block is resolved first, so a repo carrying neither block hears
 * about the one the command is named for. All three are resolved at startup so an
 * unshippable configuration is refused before any ticket is built.
 */
const resolveQueueStartup = ({ config, env }: { config: LightsoutConfig; env: NodeJS.ProcessEnv }) => {
	const settings = resolveQueueSettings({ config });

	if ('error' in settings) {
		return { error: settings.error };
	}

	const trackerSettings = resolveTrackerSettings({ config, env });

	if ('error' in trackerSettings) {
		return { error: trackerSettings.error };
	}

	const shipSettings = resolveShipSettings({ config });

	if (shipSettings === undefined) {
		return { error: unusableTicketPatternMessage };
	}

	return { settings, trackerSettings, shipSettings };
};

// Drawn from this process's report, not the coordinator run, so it never shows
// another run's board and still draws when the drain created no run.
const renderFinalBoard = ({ report }: { report: QueueDrainReport }) => {
	const at = new Date();
	const tickets = toQueueBoardTickets({ settled: report, at: at.toISOString() });

	return renderQueueBoard({ tickets, state: QueueBoardState.Finished, at });
};

// A ticket must never vanish from the summary, so the left-behind ones print too.
const renderDrainReport = ({ report }: { report: QueueDrainReport }) => {
	const lines: string[] = [];

	for (const outcome of report.outcomes) {
		if (outcome.ready) {
			lines.push(`${outcome.ticket.identifier} ${outcome.branch} shipped`);

			if (outcome.reconciliationFailure !== undefined) {
				lines.push(`  ${outcome.reconciliationFailure}`);
			}
		} else {
			// A ticket left open is not a park: its work is finished as far as it
			// goes, and it is waiting on a human rather than on a re-run.
			const stop = outcome.open === undefined ? `parked: ${outcome.error ?? 'no reason recorded'}` : `left open: ${outcome.open}`;

			lines.push(`${outcome.ticket.identifier} ${outcome.branch} ${stop}`, `  worktree: ${outcome.worktreePath}`);
		}
	}

	for (const entry of report.leftBehind) {
		lines.push(`${entry.identifier} ${entry.reason}`);
	}

	return lines;
};

// A summary that cannot be saved must not change how the drain ended. A drain
// that found nothing to do created no run folder, so it has nowhere to save one.
const saveQueueSummary = async ({ cwd, runId, summary }: { cwd: string; runId: string; summary: QueueSummary }) => {
	try {
		await writeQueueSummary({ cwd, runId, summary });
	} catch (error) {
		if (!(error instanceof RunNotFoundError)) {
			console.error(`could not save the summary of queue run ${runId}: ${messageOf({ error })}`);
		}
	}
};

// Printed and saved from the same lines, so what status shows later is what the
// queue printed when it ended.
const finishDrain = async ({ cwd, runId, report }: { cwd: string; runId: string; report: QueueDrainReport }) => {
	const boardLines = renderFinalBoard({ report });
	const reportLines = renderDrainReport({ report });

	for (const line of [...boardLines, '', ...reportLines]) {
		console.log(line);
	}

	// Exit 2 only when a re-run has something to pick up. A settled ticket, a
	// reconciliation failure on a merged branch, and a ticket left open for a
	// human do not count.
	const resumable = report.leftBehind.some((entry) => entry.settled !== true) || report.outcomes.some((outcome) => isParkedOutcome({ outcome }));
	const code = resumable ? pausedExitCode : 0;

	await saveQueueSummary({ cwd, runId, summary: { boardLines, reportLines, exitCode: code, finishedAt: new Date().toISOString() } });

	return code;
};

// `parseFlags` hands back `true` for a bare `--file-relay`, which means the
// default mailbox. One resolution for the drain and for a detached launch's
// parent, so the parent names exactly the directory its child empties and watches.
const resolveRelayMailbox = ({ requested, cwd }: { requested: string | true | undefined; cwd: string }) =>
	requested === true || requested === undefined ? resolve(cwd, '.lightsout', 'queue', 'relay') : resolve(cwd, requested);

const buildRelay = async ({
	requested,
	settings,
	trackerSettings,
	cwd,
}: {
	requested: string | true | undefined;
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
	cwd: string;
}) => {
	if (requested === undefined) {
		return new TerminalQuestionRelay({ settings, trackerSettings, input: process.stdin, output: process.stdout });
	}

	const directory = resolveRelayMailbox({ requested, cwd });

	await emptyRelayMailbox({ directory });
	// Printed because the default is only useful if the reader can see where it
	// landed, and a relative value resolves against `--cwd` like every other path.
	console.log(`relaying questions through ${directory}`);

	return new FileQuestionRelay({ settings, trackerSettings, directory, output: process.stdout });
};

/**
 * A detached queue implies the file relay: nobody is at a terminal to answer.
 * The parent never empties the mailbox, never runs the live-relay pre-check and
 * never sets `LIGHTSOUT_NO_SHIP` — all of that is the child's.
 */
const launchDetachedQueue = async ({ flags, rest, cwd }: CommandContext) => {
	if (flags.get('detach') !== true) {
		console.error(usage);
		return exitCli({ code: 1 });
	}

	const args = flags.has('file-relay') ? rest : [...rest, '--file-relay'];
	const relayMailbox = resolveRelayMailbox({ requested: flags.get('file-relay'), cwd });

	return exitCli({ code: await launchDetached({ cwd, command: 'queue', args, runId: randomUUID(), relayMailbox }) });
};

// The workers are implement work, so they resolve the config's `implement`
// harness entry rather than a `queue` key of their own.
export const queueCommand = async ({ flags, rest, cwd }: CommandContext): Promise<void> => {
	// First, so no worker or harness inherits an id meant for this process alone.
	const launchedRunId = readLaunchRunId({ env: process.env });

	if (flags.has('detach')) {
		return launchDetachedQueue({ flags, rest, cwd });
	}

	// Read once, so every ticket of this drain records the one config the queue started with.
	const loadedConfig = await readLoadedConfig({ cwd });
	const startup = resolveQueueStartup({ config: loadedConfig.config, env: process.env });

	if ('error' in startup) {
		console.error(startup.error);
		return exitCli({ code: 1 });
	}

	const { settings, trackerSettings, shipSettings } = startup;
	const { config, driver, driverName } = resolveEffectiveConfigAndDriver({ config: loadedConfig.config, command: 'implement' });
	const requested = flags.get('file-relay');

	if (requested !== undefined) {
		const holder = await readRunLock({ cwd });

		// Emptying the mailbox of a live drain would delete every question in
		// flight. The lock inside `runQueue` is the real mutual exclusion; this
		// only moves the refusal ahead of the first destructive write.
		if (holder !== undefined && isPidAlive({ pid: holder.pid })) {
			console.error(
				`another lightsout run is active in this repo: run ${holder.runId} (pid ${holder.pid}) — its relay mailbox is live, so this drain refuses rather than emptying it`,
			);

			return exitCli({ code: 1 });
		}
	}

	// Inherited by every worker: the drain's serial merge is the only ship path in
	// a queue run, whatever a worktree's config says. The coordinator calls
	// `runShip` directly and never reads this.
	process.env.LIGHTSOUT_NO_SHIP = '1';

	const runId = launchedRunId ?? randomUUID();
	const relay: QuestionRelay = await buildRelay({ requested, settings, trackerSettings, cwd });
	const report = await runQueue({
		cwd,
		runId,
		// A detached child always records its run, so its parent's handshake and
		// the saved summary have a run to find even when there is nothing to drain.
		recordEmptyDrain: launchedRunId !== undefined,
		settings,
		trackerSettings,
		shipSettings,
		config,
		loadedConfig,
		env: process.env,
		driver,
		driverName,
		relay,
		onProgress: createProgressPrinter(),
	}).finally(() => relay.close());

	if ('error' in report) {
		console.error(report.error);
		return exitCli({ code: 1 });
	}

	return exitCli({ code: await finishDrain({ cwd, runId, report }) });
};
