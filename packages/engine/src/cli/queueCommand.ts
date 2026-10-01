import { resolve } from 'node:path';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { pausedExitCode } from '#src/cli/internal/common/constants/pausedExitCode.ts';
import { QueueBoardState } from '#src/cli/internal/common/constants/QueueBoardState.ts';
import { unusableTicketPatternMessage } from '#src/cli/internal/common/constants/unusableTicketPatternMessage.ts';
import { renderQueueBoard } from '#src/cli/internal/common/queueBoard/renderQueueBoard.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import { resolveEffectiveConfigAndDriver } from '#src/cli/internal/common/utils/resolveEffectiveConfigAndDriver.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { toQueueBoardTickets } from '#src/queue/board/toQueueBoardTickets.ts';
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
const printFinalBoard = ({ report }: { report: QueueDrainReport }) => {
	const at = new Date();
	const tickets = toQueueBoardTickets({ settled: report, at: at.toISOString() });

	for (const line of renderQueueBoard({ tickets, state: QueueBoardState.Finished, at })) {
		console.log(line);
	}

	console.log('');
};

// A ticket must never vanish from the summary, so the left-behind ones print too.
const printDrainReport = ({ report }: { report: QueueDrainReport }) => {
	for (const outcome of report.outcomes) {
		if (outcome.ready) {
			console.log(`${outcome.ticket.identifier} ${outcome.branch} shipped`);

			if (outcome.reconciliationFailure !== undefined) {
				console.log(`  ${outcome.reconciliationFailure}`);
			}
		} else {
			// A ticket left open is not a park: its work is finished as far as it
			// goes, and it is waiting on a human rather than on a re-run.
			const stop = outcome.open === undefined ? `parked: ${outcome.error ?? 'no reason recorded'}` : `left open: ${outcome.open}`;

			console.log(`${outcome.ticket.identifier} ${outcome.branch} ${stop}`);
			console.log(`  worktree: ${outcome.worktreePath}`);
		}
	}

	for (const entry of report.leftBehind) {
		console.log(`${entry.identifier} ${entry.reason}`);
	}
};

// `parseFlags` hands back `true` for a bare `--file-relay`, which means the
// default mailbox.
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

	const directory = requested === true ? resolve(cwd, '.lightsout', 'queue', 'relay') : resolve(cwd, requested);

	await emptyRelayMailbox({ directory });
	// Printed because the default is only useful if the reader can see where it
	// landed, and a relative value resolves against `--cwd` like every other path.
	console.log(`relaying questions through ${directory}`);

	return new FileQuestionRelay({ settings, trackerSettings, directory, output: process.stdout });
};

// The workers are implement work, so they resolve the config's `implement`
// harness entry rather than a `queue` key of their own.
export const queueCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const loaded = await readConfig({ cwd });
	const startup = resolveQueueStartup({ config: loaded, env: process.env });

	if ('error' in startup) {
		console.error(startup.error);
		return exitCli({ code: 1 });
	}

	const { settings, trackerSettings, shipSettings } = startup;
	const { config, driver, driverName } = resolveEffectiveConfigAndDriver({ config: loaded, command: 'implement' });
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

	const relay: QuestionRelay = await buildRelay({ requested, settings, trackerSettings, cwd });
	const report = await runQueue({
		cwd,
		settings,
		trackerSettings,
		shipSettings,
		config,
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

	printFinalBoard({ report });
	printDrainReport({ report });

	// Exit 2 only when a re-run has something to pick up. A settled ticket, a
	// reconciliation failure on a merged branch, and a ticket left open for a
	// human do not count.
	const resumable = report.leftBehind.some((entry) => entry.settled !== true) || report.outcomes.some((outcome) => isParkedOutcome({ outcome }));

	return exitCli({ code: resumable ? pausedExitCode : 0 });
};
